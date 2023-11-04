import { Composer, Scenes } from "telegraf";
import rlhubContext from "../models/rlhubContext";
import { IUser, User } from "../../models/IUser";
import { ChatModel, IChat } from "../../models/IChat";
import greeting from "./chatView/chat.greeting";
import create_new_chat_handler from "./chatView/createNewChat";
import { ObjectId } from "mongoose";
import { sendRequest } from "./chatView/sendRequest";
import { ExtraEditMessageText } from "telegraf/typings/telegram-types";
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai";
const configuration = new Configuration({
    apiKey: process.env.apikey,
});

const openai = new OpenAIApi(configuration);
const handler = new Composer<rlhubContext>();
const chat = new Scenes.WizardScene("chatgpt", handler,
    async (ctx: rlhubContext) => await create_new_chat_handler(ctx), // не работает
    async (ctx: rlhubContext) => await new_chat_handler(ctx),
    async (ctx: rlhubContext) => await select_chat_handler(ctx),
    async (ctx: rlhubContext) => await saving_dialog(ctx)
)

chat.enter(async (ctx: rlhubContext) => await greeting(ctx))

chat.command('main', async (ctx) => {
    return ctx.scene.enter('home')
})

// Генерация случайного целого числа от min до max
function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

chat.action("list", async (ctx: rlhubContext) => {

    try {

        const user: IUser | null = await User.findOne({
            id: ctx.from?.id
        })

        let chats: IChat[] | null = []

        if (user?.chats) {
            for (let i = 0; i < user.chats.length; i++) {

                let dialog: IChat | null = await ChatModel.findById(user.chats[i])
                if (dialog) {

                    // console.log(dialog)
                    chats.push(dialog)

                }

            }
        }


        console.log(chats)

        let message: string = `<b>Мои диалоги</b>\n\n`

        message += `Количество созданных диалогов: <b>${chats.length}</b>`

        let extra: ExtraEditMessageText = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: []
            }
        }

        for (let i = 0; i < chats.length; i++) {

            // message += `${i + 1}. ${chats[i].name} \n`

            let dialog_name: string | undefined = chats[i].name

            if (dialog_name) {
                let shortedString = dialog_name?.length > 20 ? dialog_name?.substring(0, 20) + "..." : dialog_name
                extra.reply_markup?.inline_keyboard.push([{ text: `${shortedString}`, callback_data: '${i} chat' }])

            }

        }

        extra.reply_markup?.inline_keyboard.push([{ text: 'Назад', callback_data: 'back' }])

        await ctx.editMessageText(message, extra).then(() => ctx.wizard.selectStep(3))

    } catch (error) {

        ctx.answerCbQuery("Возникла ошибка")
        console.error(error)

    }

})

handler.action("home", async (ctx: rlhubContext) => {
    try {

        ctx.answerCbQuery()
        return await ctx.scene.enter('home')

    } catch (error) {

        console.error(error)

    }
})

handler.action("new_chat", async (ctx) => {

    try {

        // уведомление о создании комнаты

        let message: string = `Создание комнаты ...`
        await ctx.editMessageText(message, { parse_mode: 'HTML' })

        await ctx.telegram.sendChatAction(ctx.from.id, "typing")

        // находим пользователя

        let user: IUser | null = await User.findOne({
            id: ctx.from?.id
        })

        if (!user || !user._id) {
            return ctx.answerCbQuery("Пользователь не найден!")
        }

        const greetingPromt = `Поприветствуй пользователя ${ctx.from.first_name !== undefined ? ctx.from.first_name : 'уважаемого'}, тебя зовут Адам. Ты в телеграмме, бот помощник диетолога.`
        const firstmessage: ChatCompletionRequestMessage = { "role": "system", "content": greetingPromt }


        let chat: IChat | undefined = {
            user_id: user._id,
            context: [ firstmessage ]
        }

        await clear_chats(user)

        // await ChatModel.findById()

        await new ChatModel(chat).save().then((async (response) => {

            if (!user) {
                return ctx.answerCbQuery("Пользователь не найден!")
            }

            await User.findByIdAndUpdate(user._id, { $push: { chats: response._id } })

            // сохраняем айди чата в контекст бота 
            ctx.scene.session.current_chat = response._id

        }))

        // console.log(ctx.scene.session.current_chat)

        let current_chat: ObjectId = ctx.scene.session.current_chat
        // let old = await ChatModel.findById(current_chat)

        if (chat && chat.context) {
            await ChatModel.findById(current_chat).then(async (document: IChat | null) => {

                await openai.createChatCompletion({
                    model: "gpt-3.5-turbo",
                    temperature: .1,
                    messages: [ firstmessage,],
                }).then(async (response) => {

                    if (response) {

                        if (response.data.choices[0].message?.content) {
                            await ctx.editMessageText(response.data.choices[0].message?.content, { parse_mode: 'HTML' })
                            ctx.wizard.selectStep(2)
                        }

                        const botReplied = response.data.choices[0].message

                        await ChatModel.findByIdAndUpdate(document._id, {
                            $push: {
                                context: botReplied
                            }
                        })

                    }

                }).catch(async (error) => {
                    console.error(error.response.data)
                })

            })
        }

    } catch (error) {

        console.error(error)
        return await greeting(ctx)

    }

})

export async function clear_chats(user: IUser) {
    try {

        if (!user.chats) {
            return false
        }

        user.chats.forEach(async (element: ObjectId, index: number) => {
            if (element) {

                const dialog: IChat | null = await ChatModel.findById(element)

                if (dialog) {
                    if (!dialog.name) {

                        await ChatModel.findByIdAndDelete(dialog._id).then(async () => {
                            console.log(`${dialog._id} удалён`)
                            await User.findByIdAndUpdate(user._id, {
                                $pull: {
                                    chats: dialog._id
                                }
                            }).then(async () => {
                                console.log(`${dialog._id} удалён из записей пользователя`)
                            })
                        })

                    }
                }

            }
        });

    } catch (error) {

        console.error(error)

    }
}

handler.action("chats", async (ctx) => {

    ctx.wizard.selectStep(3)
    ctx.answerCbQuery()
    
    let user = await User.findOne({
        id: ctx.from?.id
    })

    let chats = await ChatModel.find({
        user_id: user?._id
    })

    const itemsOnPerPage = 5

    if (chats.length) {
        if (chats.length > itemsOnPerPage) {

            const pages = Math.ceil(chats.length / itemsOnPerPage)
            const sliced = chats.slice(0, itemsOnPerPage)

            sliced.forEach(async (element) => {
                console.log(element.name)
            })

        } else {

            let message: string = 'Выберите чат, с которым хотите продолжить работу'
            let extra: ExtraEditMessageText = {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: []
                }
            }

            chats.forEach(async (chat) => {

            })

            extra.reply_markup?.inline_keyboard.push([{ text: 'Назад', callback_data: 'back' }])
            await ctx.editMessageText(message, extra)
            ctx.wizard.selectStep(3)

        }
    }

})

handler.on("message", async (ctx) => await greeting(ctx))

async function select_chat_handler(ctx: rlhubContext) {
    try {
        if (ctx.updateType === 'callback_query') {

            let data: string = ctx.update.callback_query.data

            if (data === 'back') {

                ctx.wizard.selectStep(0)
                await greeting(ctx)

            }

            ctx.answerCbQuery()

        }
    } catch (error) {
        console.error(error)
    }
}

async function new_chat_handler(ctx: rlhubContext) {
    try {

        if (ctx.updateType === 'message') {

            ctx.replyWithChatAction('typing');

            return await sendRequest(ctx)
            
        }

    } catch (error) {

        console.log(error)

    }
}

async function saving_dialog(ctx: rlhubContext) {
    try {

        if (ctx.updateType === 'message') {

            if (ctx.update.message.text) {

                const ChatID: ObjectId = ctx.scene.session.current_chat
                await ChatModel.findByIdAndUpdate(ChatID, {
                    $set: {
                        name: ctx.update.message.text
                    }
                }).then(async () => {

                    await ctx.reply(`Ваш диалог сохранен под названием <b>${ctx.update.message.text}</b>`, { parse_mode: 'HTML' })
                    return await greeting(ctx)

                }).catch(async (error) => {

                    await ctx.reply('Возникла ошибка с базой данных')
                    console.error(error)

                })

            } else {

                await ctx.reply('Отправьте в виде текста')

            }

        }

    } catch (error) {

        console.error(error)

    }
}

export default chat