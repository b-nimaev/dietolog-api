import { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum, Configuration, CreateCompletionRequest, OpenAIApi } from "openai";
import rlhubContext from "../../models/rlhubContext";
import { ObjectId } from "mongoose";
import { ChatModel, ContextModel, IChat, PromtModel } from "../../../models/IChat";
import dotenv from 'dotenv';
import { FmtString } from "telegraf/typings/format";
import greeting from "../chatView/chat.greeting";
import { send_query } from "../../../qdrant";
dotenv.config()
const configuration = new Configuration({
    apiKey: process.env.apikey,
});

const openai = new OpenAIApi(configuration);

export async function sendRequest(ctx: rlhubContext) {
    try {
        
        await ctx.telegram.sendChatAction(ctx.from.id, 'typing');

        if (ctx.updateType === 'message') {

            ctx.scene.session.answer = ctx.update.message.text
            
            const answer = ctx.scene.session.answer

            const chatID: ObjectId = ctx.scene.session.current_chat

            // // step1
            // await ChatModel.findByIdAndUpdate(chatID, {
            //     $push: {
            //         context: {
            //             role: 'user',
            //             content: ctx.update.message.text
            //         }
            //     }
            // })

            const contextParams = await ContextModel.find()

            let arr = ``
            // загрузка шаблонов 
            if (contextParams.length > 0) {
                for (let i = 0; i < contextParams.length; i++) {

                    const firstparam = contextParams[i].content.replace("Первый параметр: ", '').replace("Второй параметр", "").split("конец первого параметра")[0]
                    arr += `Шаблон #${i}: ${firstparam};`

                    // chat.context.push({ role: 'system', content: 'Заготовка ' + i + ' :' + contextParams[i].content.replace("Первый параметр: ", '').replace("Второй параметр", "").split("конец первого параметра")[0] })

                }
            }
            
            const userQuery: ChatCompletionRequestMessage = {
                role: 'user',
                content: 'Пользователь: ' + answer
            }

            // await ChatModel.findByIdAndUpdate(chatID, {
            //     $push: {
            //         context: userQuery
            //     }
            // })

            await ChatModel.findById(chatID).then(async (document) => {
                if (document) {
                    if (document.context) {
                        console.log(document.context)

                        await openai.createChatCompletion({
                            model: "gpt-4",
                            temperature: .6,
                            // @ts-ignore
                            messages: document.context.concat([({ role: 'system', content: arr.replace(/\n/g, '') })]).concat([userQuery])
                        }).then(async (response) => {
                            
                            console.log(response.data.usage)

                            if (response.data) {
                                                            
                                if (response.data.choices) {

                                        if (response.data.choices[0]) {
                                            
                                            if (response.data.choices[0].message) {
                                                if (response.data.choices[0].message.content) {
                                                    
                                                    
                                                    const content: string = response.data.choices[0].message.content
                                                    console.log(content)

                                                    if (content.toLocaleLowerCase().includes("null")) {
                                                        return await send_query(ctx.update.message.text, ctx)
                                                    }

                                                    if (content.toLowerCase().includes("шаблон")) {
                                                        let str = response.data.choices[0].message.content.replace(/\D/g, '');
                                                        let indx = parseFloat(str)

                                                        let context = await ContextModel.find()

                                                        let selectedContext

                                                        for (let i = 0; i < context.length; i++) {

                                                            if (i === indx) {
                                                                selectedContext = context[i]
                                                            }

                                                        }

                                                        let par2 = selectedContext.content.replace("Первый параметр:", "").replace("Второй параметр:", "").split("конец первого параметра")[1]

                                                        let how_to_answer = ``

                                                        const promts = await PromtModel.find()
                                                        for (let i = 0; i < promts.length; i++) {
                                                            how_to_answer += promts[i].content + '.'
                                                        }

                                                        await openai.createChatCompletion({
                                                            model: "gpt-3.5-turbo-16k",
                                                            temperature: .8,
                                                            messages: [
                                                                    { role: 'system', content: 'Дай ответ, отформатированный и продаваемый, как говорил бы мастер диетолог. Вот надо переписать: ' + par2 },
                                                                    { role: 'system', content: 'От себя добавлять ничего не нужно' }
                                                                ]
                                                        }).then(async (response2) => {
                                                            await ctx.reply(`${response2.data.choices[0].message.content}`, { parse_mode: 'HTML' })
                                                        })

                                                    } else {

                                                        // console.log('не часть шаблона')
                                                        return await send_query(ctx.update.message.text, ctx)

                                                    }


                                                
                                                }
                                            }


                                        }

                                }
                            }


                            // await ChatModel.findByIdAndUpdate(document._id, {
                            //     $push: {
                            //         context: response.data.choices[0].message
                            //     }
                            // })
                            
                        }).catch(async (error) => {
                            
                            await ctx.reply('Возникла ошибка')
                            await greeting(ctx)

                            console.error(error.data)
                        })
                    }
                }
            })
            

        }

    } catch (err) {
        console.error(err)
    }
}