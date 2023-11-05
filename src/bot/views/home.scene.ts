import { Composer, Scenes } from "telegraf";
import { ExtraEditMessageText } from "telegraf/typings/telegram-types";
import { ISentence, Sentence } from "../../models/ISentence";
import { IUser, User } from "../../models/IUser";
import rlhubContext from "../models/rlhubContext";
import { sendRequest } from "./chatView/sendRequest";
import { ObjectId } from "mongoose";
import { IChat, ChatModel, ContextModel, PromtModel } from "../../models/IChat";
import { clear_chats } from "./chat.scene";
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
    apiKey: process.env.apikey,
});

const openai = new OpenAIApi(configuration);

const handler = new Composer<rlhubContext>();
const home = new Scenes.WizardScene("home",
    handler,
    async (ctx) => {
        try {

            if (ctx.updateType === 'message') {
                if (ctx.update.message.text === '/start') {
                    ctx.scene.enter('home')
                }

                await sendRequest(ctx)

            }

        } catch (error) {

            ctx.reply('Упс, Ошибка')
            console.error(error)

        }
    },
    async (ctx: rlhubContext) => await study_model_handler(ctx),
    async (ctx: rlhubContext) => await add_firstParamHandler(ctx),
    async (ctx: rlhubContext) => await add_2ParamHandler(ctx),
    async (ctx: rlhubContext) => await params_confirm_handler(ctx),
    async (ctx: rlhubContext) => await promts_section_handler(ctx),
    async (ctx: rlhubContext) => await edit_promt_section_handler(ctx),
    async (ctx: rlhubContext) => {
        try {

            if (ctx.updateType === 'message') {

                await PromtModel.findByIdAndUpdate(ctx.scene.session.promtForEdit, {
                    $set: {
                        content: ctx.update.message.text
                    }
                })
                await ctx.reply('Промт сохранён!')
                // ctx.wizard.selectStep(7)
                promtsRender(ctx)

            }

        } catch (error) {
            console.log(error)
        }
    },
    async (ctx: rlhubContext) => {
        try {

            if (ctx.updateType === 'message') {

                const promts = await PromtModel.find()

                // @ts-ignore

                for (let i = 0; i < promts.length; i++) {

                    if ((i + 1) === parseFloat(ctx.update.message.text)) {

                        await PromtModel.findByIdAndDelete(promts[i]._id)

                        await ctx.reply('Промт удален!')

                    }

                }

                // ctx.wizard.selectStep(7)
                promtsRender(ctx)

            }

        } catch (error) {
            console.log(error)
        }
    }
    // async (ctx: rlhubContext) => await add_promts_handler(ctx)
);

export async function greeting(ctx: rlhubContext, reply?: boolean) {

    let user: IUser | null = await User.findOne({ id: ctx.from?.id })

    const extra: ExtraEditMessageText = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Начать диалог', callback_data: "start-chat" },
                    { text: 'Обучить модель', callback_data: "study-model" }
                ],
            ]
        }
    }

    if (user.is_admin) {
        extra.reply_markup.inline_keyboard.push([{ text: 'Промты', callback_data: 'promts' }])
    }

    let message: string = ` Я здесь, чтобы помочь тебе с ответами на вопросы о питании и диете.`

    ctx.wizard.selectStep(0)

    try {

        ctx.updateType === 'callback_query' ? await ctx.editMessageText(message, extra) : ctx.reply(message, extra)

    } catch (err) {

        console.log(err)

    }
}

home.action("promts", async (ctx: rlhubContext) => await promtsRender(ctx))
async function promtsRender(ctx: rlhubContext) {
    try {

        let message: string = `Настройка промтов\n\n`

        const promts = await PromtModel.find()

        for (let i = 0; i < promts.length; i++) {

            message += `${i + 1}. ${promts[i].content}\n`

        }

        const extra: ExtraEditMessageText = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Добавить промты', callback_data: 'add-promt' }],
                    [{ text: 'Редактировать промты', callback_data: 'edit-promt' }],
                    [{ text: 'Удалить промты', callback_data: 'delete-promt' }],
                    [{ text: 'Назад', callback_data: 'back' }],
                ]
            }
        }

        ctx.updateType === 'callback_query' ? ctx.editMessageText(message, extra) : ctx.reply(message, extra)
        ctx.wizard.selectStep(6)

    } catch (error) {
        console.error(error)
    }
}
async function promts_section_handler(ctx: rlhubContext) {
    try {

        if (ctx.updateType === 'callback_query') {

            const data: string = ctx.update.callback_query.data

            if (data === 'add-promt') {

                // ctx.wizard.selectStep(7)
                let message: string = `Добавление промтов\n\n`

                message += `Отправьте значение промта`

                await ctx.editMessageText(message)

            }

            if (data === 'edit-promt') {

                let message: string = `Редактирвоние промта\n\n`

                message += `<i>Отправьте номер промта:</i>\n\n`
                const promts = await PromtModel.find()

                for (let i = 0; i < promts.length; i++) {

                    message += `${i + 1}. ${promts[i].content}\n`

                }
                ctx.wizard.selectStep(7)
                await ctx.editMessageText(message, {
                    parse_mode: 'HTML'
                })

            }

            if (data === 'delete-promt') {

                let message: string = `Удаление промта\n\n`

                message += `<i>Отправьте номер промта:</i>\n\n`
                const promts = await PromtModel.find()

                for (let i = 0; i < promts.length; i++) {

                    message += `${i + 1}. ${promts[i].content}\n`

                }
                ctx.wizard.selectStep(9)
                await ctx.editMessageText(message, {
                    parse_mode: 'HTML'
                })

            }

            if (data === 'back') {

                await greeting(ctx)

            }

            if (data === 'yes') {

                await new PromtModel({ content: ctx.scene.session.promtContent }).save()
                await promtsRender(ctx)

            }


            if (data === 'no') {
                // ctx.wizard.selectStep(7)
                let message: string = `Добавление промтов\n\n`

                message += `Отправьте значение промта`
                await ctx.editMessageText(message)
            }

        }

        if (ctx.updateType === 'message') {

            ctx.scene.session.promtContent = ctx.update.message.text
            let message = `Вы уверены, что хотите сохранить следующий промт: ${ctx.update.message.text}`
            const extra: ExtraEditMessageText = {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Да', callback_data: 'yes' }, { text: 'Нет', callback_data: 'no' }]
                    ]
                }
            }

            await ctx.reply(message, extra)

        }

    } catch (error) {
        console.error(error)
    }
}

async function edit_promt_section_handler(ctx: rlhubContext) {
    try {

        if (ctx.updateType === 'message') {

            const promts = await PromtModel.find()

            if (ctx.update.message.text) {

                if (parseFloat(ctx.update.message.text) > 0 && parseFloat(ctx.update.message.text) <= promts.length) {

                    const promt = promts[parseFloat(ctx.update.message.text) - 1]

                    let message = `Отправьте отредактированный промт для текста:\n\n`

                    message += `${promt.content}`

                    ctx.reply(message, { parse_mode: 'HTML' })
                    ctx.scene.session.promtForEdit = promt._id
                    ctx.wizard.selectStep(8)

                }

            }

        }

    } catch (error) {
        console.error(error)
    }
}

home.action("study-model", async (ctx: rlhubContext) => await study_model_gereration(ctx))

async function params_confirm_handler(ctx: rlhubContext) {
    try {

        if (ctx.updateType === 'callback_query') {

            let data: 'continue' | 'back' = ctx.update.callback_query.data

            if (data === 'back') {

                await add_2ParamHandlerRender(ctx)

            }

            if (data === 'continue') {

                let data: {
                    role: String,
                    content: String
                } = {
                    role: 'system',
                    content: `Первый параметр: ${ctx.scene.session.firstParameter} конец первого параметра. Второй параметр: ${ctx.scene.session.secondParameter}`
                }

                await new ContextModel(data).save()
                await add_data_render(ctx)
                ctx.answerCbQuery('Сохранено!')

            }

        }

    } catch (error) {
        console.error(error)
    }
}

async function add_2ParamHandler(ctx: rlhubContext) {
    try {

        if (ctx.updateType === 'callback_query') {

            let data: 'back' = ctx.update.callback_query.data

            if (data === 'back') {

                await add_data_render(ctx) // wizard step 3 

            }

        } else if (ctx.updateType === 'message') {

            if (ctx.update.message.text) {

                let message: string = ctx.update.message.text

                ctx.scene.session.secondParameter = message

                let message2 = `На примерный вопрос: <b>${ctx.scene.session.firstParameter}</b>\nБудет следующий ответ: ${message}`

                let extra: ExtraEditMessageText = {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Подтвердить', callback_data: 'continue' }],
                            [{ text: 'Назад', callback_data: 'back' }]
                        ]
                    }
                }

                await ctx.reply(message2, extra)
                // await ctx.reply(message, extra)

                ctx.wizard.selectStep(5)


            }

        }

    } catch (error) {
        console.error(error)
    }
}

async function add_2ParamHandlerRender(ctx: rlhubContext) {
    try {


        let extra: ExtraEditMessageText = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Назад', callback_data: 'back' }]
                ]
            }
        }

        ctx.wizard.selectStep(4) // to 2 param

        if (ctx.updateType === 'message') {

            let message: string = ctx.update.message.text
            ctx.scene.session.firstParameter = message

            message = `Отправьте ответ к вопросу: <b>${message}</b>`

            await ctx.reply(message, extra)

        } else {

            await ctx.editMessageText(`Отправьте ответ к вопросу: <b>${ctx.scene.session.firstParameter}</b>`, extra)

        }

    } catch (error) {
        console.error(error)
    }
}

async function add_firstParamHandler(ctx: rlhubContext) {
    try {

        if (ctx.updateType === 'callback_query') {

            let data: 'back' = ctx.update.callback_query.data

            if (data === 'back') {

                await study_model_gereration(ctx)

            }

        } else if (ctx.updateType === 'message') {

            await add_2ParamHandlerRender(ctx)

        } else {

            await add_data_render(ctx)

        }

    } catch (error) {
        console.error(error)
    }
}

async function add_data_render(ctx: rlhubContext) {
    try {

        let message: string = `Отправьте первый параметр: <b>Вопрос, который может задать клиент языковой модели</b>`
        let extra: ExtraEditMessageText = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Назад', callback_data: 'back' }]
                ]
            }
        }

        ctx.updateType === 'callback_query' ? await ctx.editMessageText(message, extra) : await ctx.reply(message, extra)
        ctx.wizard.selectStep(3)

    } catch (error) {
        console.error(error)
    }
}

async function study_model_handler(ctx: rlhubContext) {
    try {

        if (ctx.updateType === 'callback_query') {

            let data: 'add-data' | 'change-data' | 'delete-data' | 'back' = ctx.update.callback_query.data

            if (data === 'add-data') {

                await add_data_render(ctx)

            }

            if (data === 'back') {

                ctx.wizard.selectStep(0)
                await greeting(ctx)

            }

            ctx.answerCbQuery()

        } else {

            await study_model_gereration(ctx)

        }

    } catch (error) {

        console.error(error)

    }
}

async function study_model_gereration(ctx: rlhubContext) {
    try {

        let message: string = `<b>Обучение GPT</b>\n\n`
        let extra: ExtraEditMessageText = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Добавить новые данные модели', callback_data: 'add-data' }],
                    [{ text: 'Редактировать данные модели', callback_data: 'change-data' }],
                    [{ text: 'Удалить данные модели', callback_data: 'delete-data' }],
                    [{ text: 'Назад', callback_data: 'back' }]
                ]
            }
        }

        ctx.updateType === 'callback_query' ? await ctx.editMessageText(message, extra) : await ctx.reply(message, extra)

        ctx.wizard.selectStep(2)

    } catch (error) {
        console.error(error)
    }
}

home.action("start-chat", async (ctx) => {

    try {

        // уведомление о создании комнаты

        let message: string = `Ждите. Создание комнаты ...`

        await ctx.editMessageText(message, { parse_mode: 'HTML' })

        await ctx.telegram.sendChatAction(ctx.from.id, "typing")

        // находим пользователя

        let user: IUser | null = await User.findOne({
            id: ctx.from?.id
        })

        if (!user || !user._id) {
            return ctx.answerCbQuery("Пользователь не найден!")
        }

        const greetingPromt = `Поприветствуй пользователя ${ctx.from.first_name !== undefined ? ctx.from.first_name : 'уважаемого'}. Ты в телеграмме, бот помощник диетолога.`
        const firstmessage: ChatCompletionRequestMessage = { "role": "system", "content": greetingPromt }

        let chat: IChat | undefined = {
            user_id: user._id,
            context: [
                { role: "system", content: "У тебя есть список шаблонов с уникальным номер, например, 'Шаблон #14: текст шаблона'."},
                { role: "system", content: "Твоя задача: поиск соответствующего шаблона на основе текста пользователя. Если шаблон существует, верни номер шаблона. Если шаблон отсутствует, верни null. Ты не должен от себя генерировать что-либо." }
                // { role: "system", content: "Я предоставляю тебе шаблоны с их уникальными идентификаторами. Если шаблон существует, твоя задача - вернуть его идентификатор. В случае отсутствия шаблона, твоя задача -  вернуть 0" },
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
        // for (let i = 0; i < promts.length; i++) {
        //     chat.context.push({ role: "system", content: promts[i].content })
        // }

        // await clear_chats(user)

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
        let old = await ChatModel.findById(current_chat)

        if (chat && chat.context) {
            await ChatModel.findById(current_chat).then(async (document: IChat | null) => {

                await openai.createChatCompletion({
                    model: "gpt-4-0613",
                    temperature: .5,
                    // @ts-ignore
                    messages: document.context.concat([
                        firstmessage
                    ]),
                }).then(async (response) => {

                    if (response) {

                        if (response.data.choices[0].message?.content) {
                            // await ChatModel.findByIdAndUpdate(response.data.choices[0].message?.content, {
                            //     $push: {
                            //         context: response.data.choices[0].message?.content
                            //     }
                            // })
                            await ctx.editMessageText(response.data.choices[0].message?.content, { parse_mode: 'HTML' })
                            ctx.wizard.selectStep(1)
                        }

                    }

                }).catch(async (error) => {
                    console.log(error)
                })

            })
        }

    } catch (error) {

        console.log(error)
        return await greeting(ctx)

    }

})

home.start(async (ctx: rlhubContext) => {

    try {

        let document: IUser | null = await User.findOne({
            id: ctx.from?.id
        })

        if (!document) {

            if (ctx.from) {

                await new User(ctx.from).save().catch(err => {
                    console.log(err)
                })

                await greeting(ctx)

            }

        } else {

            await greeting(ctx)

        }

    } catch (err) {
        console.log(err)
    }
});

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

home.enter(async (ctx) => { return await greeting(ctx) })

handler.on("message", async (ctx) => await greeting(ctx))

home.action(/\./, async (ctx) => {

    console.log(ctx)
    await greeting(ctx)

})
export default home