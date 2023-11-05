import express from 'express';
import bodyParser from 'body-parser';
import { IUser, User } from './models/IUser';
import { IPayment, Payment } from './models/IPayment';
import { ObjectId } from 'mongodb';
import { bot } from './index';
import cors from 'cors';
const morgan = require("morgan")
const PORT = process.env.PORT;
import https from 'https';
import fs from 'fs';
import axios from 'axios';
import { client, importdataset, singleUpsertVector } from './qdrant';
import { ChatModel, ContextModel, PromtModel } from './models/IChat';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai";
import dotenv from 'dotenv';
import { idText } from 'typescript';
import rlhubContext from './bot/models/rlhubContext';
import { greeting } from './bot/views/home.scene';
dotenv.config()
const configuration = new Configuration({
    apiKey: process.env.apikey,
});
const uuid = require('uuid');

const openai = new OpenAIApi(configuration);

const app = express();
export const secretPath = `/telegraf/secret_path`;
app.use(bodyParser.json());
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    next();
});
console.log('123')

const privateKey = fs.readFileSync('./ssl/privkey.pem', 'utf8');
const certificate = fs.readFileSync('./ssl/fullchain.pem', 'utf8');
const credentials = {
    key: privateKey,
    cert: certificate,
};
// Настройка CORS
const corsOptions = {
    origin: '*', // Замените на адрес вашего клиентского приложения
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.post(`/telegraf/secret_path`, (req, res) => {
    bot.handleUpdate(req.body, res);
});

app.get("/", (req, res) => res.send("Бот запущен!"))

app.get("/api/collections", async (req, res) => {
    try {
        const collections = await client.getCollections()
        res.send(collections)
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while retrieving collections' });
    }
});

app.get("/api/collections/:collectionName", async (req, res) => {
    try {

        const collectionName = req.params.collectionName;
        console.log(collectionName); // logging the collectionName

        const collection = await client.getCollection(collectionName)

        res.send(collection)

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while retrieving collections' });
    }
});

app.get("/api/collections/:collectionName/getVectors", async (req, res) => {
    try {

        const collectionName = req.params.collectionName;
        console.log(collectionName); // logging the collectionName

        // const collection = await client.

        const context = await ContextModel.find()
        let firstParams = []
        let secondParams = []
        for (let i = 0; i < context.length; i++) {

            const currentContext = context[i]
            const firstParam = currentContext.content.split("Первый параметр: ")[1].split("Второй параметр: ")[0].replace("конец первого параметра.", '').trim()
            const secondParam = currentContext.content.split("Первый параметр: ")[1].split("Второй параметр: ")[1].replace("конец первого параметра.", '').trim()

            firstParams.push({
                value: firstParam,
                meta: currentContext.uuid
            })

            secondParams.push({
                value: firstParam,
                meta: currentContext.uuid
            })

        }

        return res.send([firstParams, secondParams])

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred while retrieving collections' });
    }
});

app.get("/api/promts", async (req, res) => {
    try {

        const promts = await PromtModel.find()

        return res.send(promts)

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'An error occurred while retrieving collections' });
    }
});

// await sendRequest('голова болит').then(res => { console.log(res.data.choices[0].message.content) })
app.delete("/api/collections/:collectionName/:uuid", async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        const uuid = req.params.uuid;

        const context = await ContextModel.findOne({ uuid: uuid })
        const firstParam = context.content.split("Первый параметр: ")[1].split("Второй параметр: ")[0].replace("конец первого параметра.", '').trim()
        const secondParam = context.content.split("Первый параметр: ")[1].split("Второй параметр: ")[1].replace("конец первого параметра.", '').trim()

        await axios(`http://65.21.153.43:6333/collections/${collectionName}/points/delete`, { method: 'POST', data: {
            points: [uuid]
        } }).then(response => {
            res.send(response.data)
            console.log(`deleted`)
        }).catch(error => {
            console.log(error.response.data)
        })

        await ContextModel.findByIdAndDelete(context._id)

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while deleting item from collection' });
    }
});

app.post("/api/collections/:collectionName/insert", async (req, res) => {
    try {
        const collectionName = req.params.collectionName;
        // const uuid = req.params.uuid;
        console.log(req.body)
        
        await singleUpsertVector(collectionName, req.body.question, req.body.answer).then(status => {
            console.log(status)
            res.send(200)
        })

        return true

    } catch (error) {

        console.error(error);

        return res.status(500).json({ error: 'An error occurred while deleting item from collection' });

    }
});

app.post("/api/promts/test", async (req, res) => {
    try {
        
        const query = await sendRequest(req.body.question)
        return res.send(query.data)
    } catch (error) {
        return res.send(error)
    }
})

app.use(morgan("dev"));
app.use(express.json())
// app.use(cors(corsOptions));
let server;
app.listen(5000, () => { console.log(`Server running on port ${PORT}`) });

const fetchData = async () => {
    const { default: fetch } = await import('node-fetch');

    const res = await fetch('http://127.0.0.1:4040/api/tunnels')
    //@ts-ignore
    // console.log(await res.json().tu)
    const json = await res.json();
    // console.log(json)
    //@ts-ignore
    const secureTunnel = json.tunnels[0].public_url
    console.log(secureTunnel)
    await bot.telegram.setWebhook(`${secureTunnel}${secretPath}`)
        .then(res => {
            console.log(res)
        })
};

async function set_webhook() {
    console.log(`${process.env.mode?.replace(/"/g, '')}`)
    if (`${process.env.mode?.replace(/"/g, '')}` === "production") {
        console.log(`${process.env.mode?.replace(/"/g, '')}`)
        console.log(`prod secret path: ${secretPath}`)
        await bot.telegram.setWebhook(`https://drvcash.com/telegraf/secret_path`)
            .then((status) => {
                console.log(secretPath);
                console.log(status);
            }).catch(err => {
                console.log(err)
            })
    } else {
        await fetchData().catch((error: any) => {
            console.error('Error setting webhook:', error);
        });
    }
};

set_webhook()


export async function sendRequest(question: string) {
    try {

        if (question) {

            const answer = question

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


            // const firstmessage: ChatCompletionRequestMessage = { "role": "system", "content": greetingPromt }

            let chat = {
                context: [
                    { role: "system", content: "У тебя есть список шаблонов с уникальным номер, например, 'Шаблон #14: текст шаблона'." },
                    { role: "system", content: "Твоя задача: поиск соответствующего шаблона на основе текста пользователя, и вернуть номер шаблона." },
                    { role: "system", content: "Если ты не можешь найти подходящий шаблон, верни текст: null"},
                    { role: "system", content: arr },
                    // { role: "system", content: "Если ты генерируешь текст, то отвечай, как диетолог с 10-ти летним стажем работы, который также прошел обучение в области психологии. Ты общаешься с клиентом, который проходит 12-ти недельную программу метаболического похудения. Ваш стиль общения смешивает профессиональные рекомендации по питанию с глубоким пониманием и заботой о психоэмоциональном состоянии клиента. Будь заботлив, эмпатичен, поддерживай, как лучший друг, но сохраняй профессиональную дистанцию." }
                    // { role: "system", content: "Я предоставляю тебе шаблоны с их уникальными идентификаторами. Если шаблон существует, твоя задача - вернуть его идентификатор. В случае отсутствия шаблона, твоя задача - найти и предоставить соответствующую информацию, которая предварительно отмечена как 'Информация:'. Если такой помеченной информации не найдено, твоя задача состоит в том, чтобы сформировать и предоставить информацию, основываясь только на входных текстах с уникальными идентификаторами 'Заготовка'. Ничего от себя не нужно добавлять." }
                    // { "role": "system", "content": "Поприветствуй пользователя, тебя зовут Адам. Ты в телеграмме, бот помощник диетолога. Ты будешь отвечать пользователям по моим заготовкам и скриптам. Только по моим заготовкам и скриптам. Ты не должен генерировать от себя текст. Первый параметр это входящий вопрос от пользователя. Второй параметр, это то, что ты должен ответить пользователю." },
                    // { "role": "system", "content": "С момента старта программы прошло более 15 дней. В заготовках будут условия связанные с условиями выдачи информации, они будут называться скрипты. Действуй по описанному скрипту во втором параметре исходя из входных данных, например, сколько дней прошло со старта программы." },
                    // { "role": "system", "content": "Если пользователь задает вопрос 'у меня не уходят объемы', он под этим подразумевает объемы фигуры. Поэтому, ты категорически не должен генерировать свой ответ. Ты должен вернуть, следующий текст: Объемы лучше отслеживать по одежде, смотреть стала ли она вам большевата, или попробовать одеть то, что было мало и посмотреть, как вы сейчас себя чувствуете в этой одежде\n\nОчень часто, когда мы ориентируемся на измерительную ленту, мы можем не увидеть итоговый результат. Например, ленту расположили по-разному. На первом измерении выше на 1 см, а второй ниже. Давайте начнем отслеживать ваши объемы по одежде, хорошо?" },
                    // { "role": "system", "content": "Если пользователь задает вопрос 'Я заболеваю, что делать? (простуда, насморк, продуло, клиентка простыла или заболела во время программы)', Ты должен вернуть, следующий текст: Сейчас нам с вами нужно поддержать организм.\n\nВ момент, когда вы почувствовали слабость, кашель, дрожь во всем теле, насморк, головные боли, чувствуете, что заболеваете, важно поддержать себя правильным питанием.В такой период питание должно состоять из продуктов не разрушающих и ослабляющих ваш организм, а дающим силу и быстрое выздоровление.\n\nПравила питания, которые нам нужно соблюдать.\n\n✅ТЕПЛАЯ ВОДА.При боле в горле, температура всей  воды на программе(кроме медовой и чаев)  должны быть 35 - 40 С, чтобы дополнительно не повреждать раздраженную слизистую глотки.Если насморк и озноб, предпочтение отдаем горячему питью.Обильное питье позволяет не только увлажнить слизистые верхних дыхательных путей, но и уменьшить концентрацию токсинов.\n\n✅Не забываем использовать клетчатку так, как прописано на вашей ступени программы.Клетчатка является источником питания для полезных кишечных бактерий, которые будут поддерживать ваш иммунитет в процессы борьбы с простудой.\n\n✅К меню вашей ступени добавляем пустой куриный горячий бульон до 3 раз в день по 250 – 300 мл на время болезни.\n\n✅Лекарственные травы и чаи: зеленый  с мятой или липовым цветом, или душицей – потогонное средство.Выпиваем перед сном в любое время  и скорее в кровать.Также можно принимать ромашку для полоскания горла, если оно болит\n\n✅Приемы пищи от начала заболевания желательно держать в пределах 2, 5 -3 часа это позволит вам уйти от пищевого срыва после болезни, так как в первый день, а часто бывает и в течении нескольких суток начала болезни организм отказывается от пищи, есть совершенно не хочется, это естественная реакция организма: он ожесточенно отражает атаку вирусов, ему «некогда» отвлекаться на переваривание пищи." },
                    // { "role": "system", "content": "Если женщина пишет о частом использовании слабительных препаратов, таких, как Бисакодил, Вазелиновое Вегапрат, Глицелакс, Глицериновые свечи, Гутталакс, Гуттасил, Динолак, Сена, Дюфалак и др., Ты должен вернуть, следующий текст: В случае стойких запоров не стоит отказываться и от мягких слабительных препаратов (если работа кишечника отсутствует более двух дней). \n\nМожно принять щадящий препарат Дюфалак. \n\nОднако пользоваться слабительными, каждый день, все же не стоит, чтобы избежать привыкания. \n\nНе нужно применять препараты на основе сены, они только усугубляют проблему, ведут к еще большей атонии кишечника и могут спровоцировать воспаление слизистой." },
                ]
            }
            const promts = await PromtModel.find()

            // загрузка промтов
            for (let i = 0; i < promts.length; i++) {
                chat.context.push({ role: "system", content: promts[i].content })
            }

            const userQuery: ChatCompletionRequestMessage = {
                role: 'user',
                content: 'Пользователь: ' + answer
            }

            return await openai.createChatCompletion({
                model: "gpt-4",
                temperature: .6,
                // @ts-ignore
                messages: chat.context.concat([({ role: 'system', content: arr.replace(/\n/g, '') })]).concat([userQuery])
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
                                        return await send_query(answer)
                                    }

                                    if (content.toLowerCase().includes("шаблон")) {
                                        let str = response.data.choices[0].message.content.replace(/\D/g, '');
                                        let indx = parseFloat(str)

                                        let context = await ContextModel.find()

                                        let selectedContext
                                        console.log(indx)
                                        for (let i = 0; i < context.length; i++) {

                                            if (i === indx) {
                                                selectedContext = context[i]
                                                console.log(i)
                                            }

                                        } 

                                        console.log(selectedContext)

                                        let par2 = selectedContext.content.replace("Первый параметр:", "").replace("Второй параметр:", "").split("конец первого параметра")[1]
                                        console.log(par2)
                                        let how_to_answer = ``

                                        const promts = await PromtModel.find()
                                        for (let i = 0; i < promts.length; i++) {
                                            how_to_answer += promts[i].content + '.'
                                        }
                                        console.log(how_to_answer)
                                        return await openai.createChatCompletion({
                                            model: "gpt-3.5-turbo-16k",
                                            temperature: .5,
                                            messages: [
                                                { role: 'system', content: how_to_answer },
                                                { role: 'system', content: `Дай ответ, отформатированный и продаваемый, как говорил бы мастер диетолог. Вот надо переписать: ${par2}` },
                                                { role: 'system', content: 'От себя добавлять ничего не нужно' }
                                            ]
                                        }).then(ans => {
                                            return ans
                                        })

                                    } else {

                                        // console.log('не часть шаблона')
                                        return await send_query(answer)

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
                
                console.error(error)
                return error

            })


        }

    } catch (err) {
        console.error(err)
    }
}

const collectionName = 'firstParams'

export async function send_query(query_string: string) {

    console.log('123')
    // const query_string = `как отслеживать объемы?`
    return await openai.createEmbedding({ input: query_string, model: 'text-embedding-ada-002' })
        .then(async (response) => {

            return await client.search(collectionName, {
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
                return await openai.createChatCompletion({
                    model: "gpt-4-0613",
                    temperature: .5,
                    messages: [
                        // {
                        //     role: 'system',
                        //     content: `Сведи в одну информацию, из текста, самое важное: ${str}. Текст должен отвечать на вопрос: ${query_string}. Есл отсутствует информация из вопроса, то передай пользователю, что он сейчас будет перенаправлен на менеджера`
                        // },
                        {
                            role: 'system',
                            content: `Если в тексте: ${str} отсутсвует ответ на вопрос от пользотваеля: ${query_string}, то напиши, что он сейчас будет перенаправлен на менеджера. Если в данном тексте есть информация по вопросу, дай ответ, исклюительно сформировав текст из данного текста. И не говори клиенту что ты ищешь информацию в тексте. Ты являешься младшим менеджером`
                        },
                        {
                            role: 'system',
                            content: `Ты отвечаешь в отформатированном тексте, не забудь разбить на логические абзацы, форматировать в HTML формате. доступные теги только: i, b, u`
                        },
                        {
                            role: 'system',
                            content: `Вот инструкции, как тебе отвечать: ${promts}`
                        },
                    ]
                })

            }).catch(error => {
                console.error(error.response.response)
            })

        })

}

(async function () {
    try {
        // await sendRequest('голова болит').then(res => { console.log(res.data.choices[0].message.content) })
    } catch (error) {
        console.log(error)
    }
})();