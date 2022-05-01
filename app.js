import { TuyaDevice, Dimmer, Outlet, MultiOutlet, Door, Sensor, Switch, Button, Garage } from './Device.js'
import { setAutomations, checkAutomations } from './Automation.js'
import { serverToken } from './credentials.js'
import { spawn } from 'child_process'
import AppleHome from './AppleHome.js'
import express from 'express'
import * as db from './Database.js'
import WebSocket from 'ws'
import { createServer } from 'http'

///////////////////////////////////////////////////////////////////////////////
// Initialize 
const app = express()
const server = createServer(app)
const wss = new WebSocket.Server({ noServer: true })
const appleHome = new AppleHome('Bridgetest', '17:51:07:F4:BC:AF', '111-22-333')

let heroku = {}
const devices = []
let automations = []

///////////////////////////////////////////////////////////////////////////////
// Find devices
const getDevice = id => devices.find(device => device.id === id)

///////////////////////////////////////////////////////////////////////////////
// Broadcast Json to heroku.
const broadcast = message => {
    if (heroku.readyState === WebSocket.OPEN) {
        heroku.send(JSON.stringify(message))
    }
}

///////////////////////////////////////////////////////////////////////////////
// Handle WebSocket connections
wss.on('connection', (ws, req, name) => {
    console.log('Connected:', name)
    ws.on('close', () => console.log('Disconnected:', name))
    ws.on('message', (message) => handleMessage(ws, message, name))
})

const startHerokuConnection = () => {
    heroku = new WebSocket('wss://home100.herokuapp.com?token=' + serverToken)
    heroku.on('open', () => heroku.send(getHerokuData()))
    heroku.on('message', data => handleMessage(heroku, data, 'Heroku'))
    heroku.on('close', () => setTimeout(startHerokuConnection, 5000))
    heroku.on('error', e => console.log(e))
}

///////////////////////////////////////////////////////////////////////////////
// Handle WebSocket upgrades
server.on('upgrade', function upgrade(request, socket, head) {
    const url = new URL(request.url, 'http://test.com')
    const deviceId = url.searchParams.get('id') || 'Client'

    wss.handleUpgrade(request, socket, head, function done(ws) {
        wss.emit('connection', ws, request, deviceId)
        if (deviceId === 'hub') {
            const hubDevices = url.searchParams.get('d')
            hubDevices.split(',').forEach(id => getDevice(id).ws = ws)
        }
    })
})

///////////////////////////////////////////////////////////////////////////////
// Handle WebSocket messages
const handleMessage = async (ws, message, name) => {
    const json = JSON.parse(message)
    console.log(name, json)
    switch (json.event) {
        case 'toggleSwitch':
        case 'toggleDevice':
            getDevice(json.id)?.toggle()
            break
        case 'setDevice':
            getDevice(json.id)?.command(json)
            break
        case 'updateButton':
        case 'updateDevice':
            getDevice(json.id)?.onMessage(json)
            break
        case 'findDevices':
            findNewDevices().then(found => {
                ws.send(JSON.stringify({ event: 'foundDevices', value: found }))
                if (found) { process.exit(1) }
            })
            break
        case 'updateAutomations':
            json.removed.forEach(async id => {
                await db.deleteAutomation(id)
            })
            await Promise.all(json.automations.map(auto => {
                return db.upsertAutomation(auto)
            }))
            process.exit(1)
        case 'updateSettings':
            json.removed.forEach(async id => {
                await updateAutomaitonDevices(id)
                await db.deleteDevice(id)
            })
            await Promise.all(json.settings.map(device => {
                return db.upsertDevice(device, false)
            }))
            process.exit(1)
    }
}

const updateAutomaitonDevices = async (id) => {
    const updates = []
    automations.forEach(auto => {
        const test = checkSequence(auto.sequence, id)
        if (auto.trigger.device === id || test === 0) {
            updates.push(db.deleteAutomation(auto.id))
        } else if (test === 1) {
            updates.push(db.upsertAutomation(auto))
        }
    })
    return Promise.all(updates)
}

const checkSequence = (sequence, id) => {
    const removeIndexs = []
    let update = false
    sequence.forEach((entry, i) => {
        switch (entry.type) {
            case 'if':
                if (entry.if.device === id) {
                    removeIndexs.push(i)
                } else {
                    const c = checkSequence(entry.then, id)
                    if (c === 0) removeIndexs.push(i)
                    else if (c === 1) update = true
                }
                break
            case 'ifElse':
                if (entry.if.device === id) {
                    removeIndexs.push(i)
                } else {
                    const c1 = checkSequence(entry.then, id)
                    const c2 = checkSequence(entry.else, id)
                    if (c1 === 0 || c2 === 0) removeIndexs.push(i)
                    else if (c1 === 1 || c2 === 1) update = true
                }
                break
            case 'device':
                if (entry.device.includes(id)) {
                    if (entry.device.length > 1) {
                        const index = entry.device.find(d => d === id)
                        entry.device.splice(index, 1)
                        update = true
                    } else {
                        removeIndexs.push(i)
                    }
                }
                break
        }
    })
    if (removeIndexs.length > 0) {
        removeIndexs.reverse().forEach(i => sequence.splice(i, 1))
        update = true
    }

    // update: 1, delete: 0, do nothing: -1
    if (update && sequence.length > 0) return 1
    if (sequence.length === 0) return 0
    return -1
}

///////////////////////////////////////////////////////////////////////////////
// Ping WebSocket connections
setInterval(() => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.ping()
        }
    })
    if (heroku.readyState === WebSocket.OPEN) {
        heroku.ping()
    }
}, 30000)


///////////////////////////////////////////////////////////////////////////////
// Send device info to Heroku
const getHerokuData = () => {
    const states = devices.map(d => d.getInfo())
    const tuyaDevices = devices.filter(d => !d.custom).map(d => d.getInfo())
    automations.sort((a, b) => {
        if (a.trigger.type === b.trigger.type) {
            switch (a.trigger.type) {
                case 'device':
                    return a.trigger.device < b.trigger.device ? -1 : 1
                case 'time':
                    return a.trigger.time < b.trigger.time ? -1 : 1
                default:
                    return a.trigger.offset < b.trigger.offset ? -1 : 1
            }
        } else {
            return a.trigger.type < b.trigger.type ? -1 : 1
        }
    })
    return JSON.stringify({
        event: 'homeData',
        data: { automations, states, devices: tuyaDevices }
    })
}

///////////////////////////////////////////////////////////////////////////////
// Scan for unregistered devices
const findNewDevices = () => {
    console.log('Searching for devices')
    return new Promise((resolve) => {
        const ls = spawn('tuya-cli', ['wizard', '-s'])
        ls.stdout.on('data', async (data) => {
            if (data.toString().match(/\(Y\/n\)\s+$/)) {
                ls.stdin.write('y\n')
            }
            if (data.toString().match(/app:\s+$/)) {
                ls.stdin.write('ebf10a3f901dee6435y0ot\n')
            }
            if (data.toString().match(/\[.*]/)) {
                let restart = false
                let deviceIps = []

                const foundDevices = JSON.parse(data.toString())
                const newDevices = foundDevices.filter(d => !devices.find(({ id }) => d.id === id))

                if (newDevices.length > 0) {
                    console.log('Found new devices, serching for device IPs')
                    deviceIps = await TuyaDevice.findIps(newDevices[0])
                }

                const promises = []
                foundDevices.forEach(device => {
                    const d = devices.find(({ id }) => device.id === id)
                    if (d === undefined) {
                        const ip = deviceIps[device.id]
                        if (ip) {
                            console.log('Adding new device:', device.name, deviceIps[device.id])
                            promises.push(db.upsertDevice({
                                type: 'outlet', name: [device.name], image: ['outlet'],
                                ip: deviceIps[device.id], key: device.key, id: device.id
                            }, false))
                            restart = true
                        } else {
                            console.log('Unable to find IP:', device.name)
                        }
                    } else if (d.key !== device.key) {
                        console.log('Update device key')
                        promises.push(db.updateDeviceInfo(device.id, { key: device.key }))
                        restart = true
                    }
                })

                await Promise.all(promises)
                resolve(restart)
            }
        })
    })
}

///////////////////////////////////////////////////////////////////////////////
// Start server
const startServer = async () => {
    const deviceSettings = await db.getDevices()
    automations = await db.getAutomations()

    deviceSettings.forEach(device => {
        switch (device.type) {
            case 'dimmer':
                devices.push(new Dimmer(device))
                break
            case 'outlet':
                devices.push(new Outlet(device))
                break
            case 'multioutlet':
                const num = device.combine ? 1 : device.number
                const tuya = new TuyaDevice(device)
                for (let i = 0; i < num; i++) {
                    devices.push(new MultiOutlet(device, tuya, i))
                }
                break
            case 'door':
                devices.push(new Door(device))
                break
            case 'sensor':
                devices.push(new Sensor(device))
                break
            case 'switch':
                devices.push(new Switch(device))
                break
            case 'button':
                devices.push(new Button(device))
                break
            case 'garage':
                devices.push(new Garage(device))
                break
        }
    })
    setAutomations(automations, devices)
    appleHome.addAccessories(devices.map(device => device.getInfo()))
    appleHome.onCommand = (info) => {
        console.log('Apple:', JSON.stringify(info))
        getDevice(info.id)?.command(info)
    }

    devices.forEach(device => {
        device.onData = (info, data) => {
            console.log(info.id, data)
            broadcast(info)
            checkAutomations(info, data)
            appleHome.updateAccessory(info)
        }
    })

    const port = process.env.PORT || 8080
    server.listen(port, () => {
        console.log(`Server listening at http://192.168.2.90:${port}`)
    })
    // startHerokuConnection()
}

startServer()
