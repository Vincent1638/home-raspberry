import axios from 'axios'

const sunTimes = {}
let allDevices = []
let entries = {}
let automations = []
let filteredAutomations = []
let automationTimeouts = []

export const setAutomations = async (auto, devices) => {
    allDevices = devices
    automations = auto.filter(a => a.enabled)
    updateTimeAutomations()

    const midnight = new Date()
    midnight.setHours(24, 0, 0, 0)

    setTimeout(() => {
        updateTimeAutomations()
        setInterval(updateTimeAutomations, 24 * 60 * 60 * 1000)
    }, midnight.getTime() - Date.now())
}

const parseTimeString = (time) => {
    const [hours, minutes] = time.split(':').map(s => parseInt(s))
    let date = new Date()
    date.setHours(hours, minutes, 0, 0)
    return date.getTime()
}

const getTimes = time => {
    let times = time.toLowerCase().replace(/\s+/g, '').split('-')

    let start
    if (times[0] == 'sunrise') start = sunTimes.sunrise
    else if (times[0] == 'sunset') start = sunTimes.sunset
    else start = parseTimeString(times[0])

    let end
    if (times[1] == 'sunrise') end = sunTimes.sunrise
    else if (times[1] == 'sunset') end = sunTimes.sunset
    else end = parseTimeString(times[1])

    return { start, end }
}

const updateTimeAutomations = async () => {
    const date = new Date()
    const weekday = date.getDay()
    filteredAutomations = automations.filter(a => a.weekdays[weekday])

    const response = await axios.get('https://api.sunrise-sunset.org/json?lat=46.114430&lng=-64.847092&formatted=0')
    sunTimes.sunrise = Date.parse(response.data.results.sunrise)
    sunTimes.sunset = Date.parse(response.data.results.sunset)

    automationTimeouts.forEach(clearTimeout)
    automationTimeouts = []

    filteredAutomations.forEach(automation => {
        let diff = 0
        switch (automation.trigger.type) {
            case 'sunset': {
                const offset = automation.trigger.offset * 1000 || 0
                diff = sunTimes.sunset - date.getTime() + offset
            } break
            case 'sunrise': {
                const offset = automation.trigger.offset * 1000 || 0
                diff = sunTimes.sunrise - date.getTime() + offset
            } break
            case 'time': {
                diff = parseTimeString(automation.trigger.time) - date.getTime()
            } break
        }
        if (diff > 0) {
            automationTimeouts.push(setTimeout(() => {
                checkSequence(automation.sequence)
            }, diff))
        }
    })
}

export const checkAutomations = (info, data) => {
    const time = Date.now()
    filteredAutomations.forEach(auto => {
        if (auto.trigger.type == 'device' && auto.trigger.device == info.id && auto.trigger.state == data.state) {
            const times = getTimes(auto.trigger.time || '00:00 - 24:00')
            if (
                (times.start < times.end && times.start <= time && time <= times.end)
                || (times.start > times.end && (times.start <= time || time <= times.end))
            ) {
                checkSequence(auto.sequence)
            }
        }
    })
}

const getDevice = id => allDevices.find(device => device.id === id)

const checkSequence = async parentId => {
    const parent = entries[parentId]
    parent.children.forEach(async id => {
        const entry = entries[id]
        switch (entry.type) {
            case 'device':
                entry.device.forEach(deviceId => {
                    getDevice(deviceId)?.command(entry)
                })
                break
            case 'wait':
                await new Promise(resolve => {
                    setTimeout(resolve, entry.wait * 1000)
                })
                break
            case 'if':
                if (checkConditions(entry.conditions)) {
                    await checkSequence(entry.thenSeq)
                }
                break
            case 'ifElse':
                if (checkConditions(entry.conditions)) {
                    await checkSequence(entry.thenSeq)
                } else {
                    await checkSequence(entry.elseSeq)
                }
                break
        }
    })
}

const checkConditions = conditions => {
    const isTrue = []
    conditions.forEach(c => {
        if (c.type === 'state') {
            const state = getDevice(c.device)?.state
            isTrue.push(c.state === state)
        } else {
            const time = Date.now()
            const start = parseTimeString(c.start)
            const end = parseTimeString(c.end)
            isTrue.push(
                (start < end && start <= time && time <= end)
                || (start > end && (start <= time || time <= end))
            )
        }
    })
    return isTrue.reduce((a, b) => a && b)
}
