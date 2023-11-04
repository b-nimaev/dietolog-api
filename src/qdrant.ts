import { QdrantClient } from '@qdrant/js-client-rest';
import { Configuration, OpenAIApi } from "openai";
import { ContextModel, PromtModel } from './models/IChat';
import dotenv from 'dotenv';
dotenv.config()
const configuration = new Configuration({
    apiKey: process.env.apikey,
});
const uuid = require('uuid');

const openai = new OpenAIApi(configuration);
export const client = new QdrantClient({
    url: 'http://65.21.153.43:6333',
    // apiKey: 'OD10q9cWSsBkuUMF4wnx20DrkWv1B3FF_5mK5a-hwuPv9kVNICk3ng',
});

import './database';
import rlhubContext from './bot/models/rlhubContext';
const collectionName = 'firstParams';

export async function send_query(query_string: string, ctx: rlhubContext) {

    console.log('123')
    // const query_string = `как отслеживать объемы?`
    await openai.createEmbedding({ input: query_string, model: 'text-embedding-ada-002' })
        .then(async (response) => {

            await client.search(collectionName, {
                vector: response.data.data[0].embedding,
                limit: 4
            }).then(async (resultsearch) => {

                let str = ``

                console.log(resultsearch)

                for (let i = 0; i < resultsearch.length; i++) {

                    if (resultsearch[i].score < 0.83) {
                        continue
                    }

                    const elementSearch = resultsearch[i]
                    await ContextModel.find().then((db) => {
                        db.forEach((element) => {

                            const firstParam = element.content.split("Первый параметр: ")[1].split("Второй параметр: ")[0].replace("конец первого параметра.", '').trim()

                            if (elementSearch.payload.reply === firstParam) {

                                const secondParam = element.content.split("Первый параметр: ")[1].split("Второй параметр: ")[1].replace("конец первого параметра.", '').trim()

                                str += `${secondParam}`.replace('\n', '').trim()

                            }

                        })
                    })

                }

                str = str.replace(/\n/g, '')

                let promtsstr = ``
                const promts = await PromtModel.find()
                for (let i = 0; i < promts.length; i++) {
                    promtsstr += promts[i].content + '.'
                }
                console.log(query_string)
                console.log(str)
                await openai.createChatCompletion({
                    model: "gpt-4-0613",
                    temperature: .5,
                    messages: [
                        {
                            role: 'system',
                            content: `${promts}`
                        },
                        // {
                        //     role: 'system',
                        //     content: `Сведи в одну информацию, из текста, самое важное: ${str}. Текст должен отвечать на вопрос: ${query_string}. Есл отсутствует информация из вопроса, то передай пользователю, что он сейчас будет перенаправлен на менеджера`
                        // },
                        {
                            role: 'system',
                            content: `Если в тексте: ${str} отсутсвует ответ на вопрос от пользотваеля: ${query_string}, то напиши, что он сейчас будет перенаправлен на менеджера. Если в данном тексте есть информация по вопросу, дай ответ.`
                        },
                        {
                            role: 'system',
                            content: `Ты отвечаешь в отформатированном тексте, не забудь разбить на логические абзацы, форматировать в HTML формате. доступные теги только: i, b, u`
                        }
                    ]
                }).then(async (readytext) => {
                    console.log(readytext.data.choices[0].message.content)
                    await ctx.reply(`${readytext.data.choices[0].message.content}`, {
                        parse_mode: 'HTML'
                    })
                }).catch(async (error) => {
                    console.error(error.response.response)
                })

            }).catch(error => {
                console.error(error.response.response)
            })

        })

}

export async function importdataset(collectionName: string) {

    try {
        const context = await ContextModel.find()

        await client.recreateCollection(collectionName, {
            vectors: {
                size: 1536,
                distance: 'Dot'
            }
        })

        for (let i = 0; i < context.length; i++) {

            const currentContext = context[i]
            const firstParam = currentContext.content.split("Первый параметр: ")[1].split("Второй параметр: ")[0].replace("конец первого параметра.", '').trim()
            const secondParam = currentContext.content.split("Первый параметр: ")[1].split("Второй параметр: ")[1].replace("конец первого параметра.", '').trim()

            openai.createEmbedding({ input: firstParam, model: 'text-embedding-ada-002' }).then((response) => {

                const embedding = response.data.data[0].embedding

                client.upsert(collectionName, {
                    points: [
                        {
                            id: context[i].uuid,
                            vector: embedding,
                            payload: {
                                "reply": `${firstParam}`,
                                "iteration": 1,
                                "name": `${firstParam}`
                            }
                        }
                    ]
                }).then(async () => {
                    console.log(`${i} обработан ...`)
                }).catch(error => {
                    console.error(error)
                })
            })

        }
    } catch (error) {
        console.error(error)
    }

};

export async function singleUpsertVector(collectionName: string, payload: string, content: string) {

    // const payload: string = `КАК ПРАВИЛЬНО ПРИНИМАТЬ КЛЕТЧАТКУ?`

    payload = payload.replace(/\n/g, '')
    content = content.replace(/\n/g, '')

    const secondParam = content

    content = `Первый параметр: ${payload} конец первого параметра. Второй параметр: ${content}`
    // const firstParam = element.content.split("Первый параметр: ")[1].split("Второй параметр: ")[0].replace("конец первого параметра.", '').trim()

    const document = await new ContextModel({
        role: 'system',
        content: content,
        uuid: uuid.v4()
    }).save()

    return openai.createEmbedding({ input: secondParam, model: 'text-embedding-ada-002' }).then((response) => {

        const embedding = response.data.data[0].embedding

        return client.upsert(collectionName, {
            points: [
                {
                    id: document.uuid,
                    vector: embedding,
                    payload: {
                        "reply": `${payload}`,
                        "iteration": 1,
                        "name": `${payload}`
                    },
                }
            ]
        }).then(async (status) => {
            console.log(status)
            return true
        }).catch(error => {
            console.error(error)
            return false
        })
    })

}

async function updateUUID() {

    const contexts = await ContextModel.find()

    for (let i = 0; i < contexts.length; i++) {
        await ContextModel.findByIdAndUpdate(contexts[i]._id, {
            $set: {
                uuid: uuid.v4()
            }
        }).then(() => {
            console.log(i)
        })
    }

}

// singleUpsertVector()

// importdataset()

(async function () {
    // await importdataset('firstParams').catch(error => { console.log(error) })
})();

// const input = { input: 'Your input string goes here', model: 'text-embedding-ada-002' };
// openai.createEmbedding(input).then(response => {
//     console.log(response.data)
//  });

