import TuyAPI from 'tuyapi'

const weekday = new Intl.DateTimeFormat('en', { weekday: 'short' })
const time = new Intl.DateTimeFormat('en', { timeStyle: 'short', hour12: true })

export class Garage {
    ws = {}
    constructor(info) {
        this.id = info.id
        this.name = info.name[0]
        this.image = info.image[0]
        this.state = false
        this.data = info.data
        this.custom = info.custom
    }

    toggle() { }

    command(command) {
        if (this.ws.readyState === 1) {
            this.ws.send(JSON.stringify(command))
        }
    }

    getState() {
        return { type: 'garage', id: this.id, state: this.state, data: this.data }
    }

    getInfo() {
        return { type: 'garage', id: this.id, name: this.name, image: this.image, state: this.state, data: this.data }
    }

    onMessage(data) {
        this.state = data.state
        this.data = data.data
        this.onData(this.getState(), data)
    }
}

export class Sensor {
    constructor(info) {
        this.id = info.id
        this.name = info.name[0]
        this.image = info.image[0]
        this.state = false
        this.data = info.data
        this.custom = info.custom
    }
    toggle() { }
    command(command) { }

    getState() {
        return { type: 'sensor', id: this.id, state: this.state, data: this.data }
    }

    getInfo() {
        return { type: 'sensor', id: this.id, name: this.name, image: this.image, state: this.state, data: this.data }
    }

    onMessage(data) {
        this.state = data.state
        if (this.state) {
            const date = new Date
            this.data = weekday.format(date) + ' ' + time.format(date)
        }
        this.onData(this.getState(), data)
    }
}

export class Door {
    constructor(info) {
        this.id = info.id
        this.name = info.name[0]
        this.image = info.image[0]
        this.state = false
        this.custom = info.custom
    }

    getState() {
        return { type: 'door', id: this.id, state: this.state }
    }

    getInfo() {
        return { type: 'door', id: this.id, name: this.name, image: this.image, state: this.state }
    }

    toggle() { }
    command(command) { }

    onMessage(data) {
        this.state = data.state
        this.onData(this.getState(), data)
    }
}

export class Button {
    constructor(info) {
        this.id = info.id
        this.name = info.name[0]
        this.image = info.image[0]
        this.state = false
        this.custom = info.custom
    }
    toggle() { }
    command(command) { }

    getState() {
        return { type: 'button', id: this.id, state: this.state }
    }

    getInfo() {
        return { type: 'button', id: this.id, name: this.name, image: this.image, state: this.state }
    }

    onMessage(data) {
        this.state = data.state
        this.onData(this.getState(), { state: true })
    }
}

export class Switch {
    ws = {}
    constructor(info) {
        this.id = info.id
        this.name = info.name[0]
        this.image = info.image[0]
        this.state = false
        this.custom = info.custom
    }
    getState() {
        return { type: 'switch', id: this.id, state: this.state }
    }

    getInfo() {
        return { type: 'switch', id: this.id, name: this.name, image: this.image, state: this.state }
    }

    toggle() {
        if (this.ws.readyState === 1) {
            this.ws.send(JSON.stringify({ id: this.id }))
        }
    }

    command(command) {
        if (this.ws.readyState === 1) {
            this.ws.send(JSON.stringify(command))
        }
    }

    onMessage(data) {
        this.state = data.state
        this.onData(this.getState(), data)
    }
}

export class TuyaDevice {
    constructor(info) {
        this.tuya = new TuyAPI({ id: info.id, key: info.key, ip: info.ip, version: 3.3 })
        this.tuya.start = async function () {
            try {
                await this.find()
                await this.connect()
                console.log('Connected:', info.name[0])
            } catch (e) {
                console.error('Unable to connect:', info.name[0])
                setTimeout(() => this.start(), 20000)
            }
        }
        this.tuya.on('disconnected', () => {
            console.error('Disconnected:', info.name[0])
            setTimeout(() => this.tuya.start(), 20000)
        })
        this.tuya.on('error', () => {
            console.error('Error:', info.name[0])
        })
        this.tuya.start()
    }

    static async findIps(data) {
        const device = new TuyAPI(data)
        const info = await device.find({ all: true })
        return Object.fromEntries(info.map(({ id, ip }) => [id, ip]))
    }
}

export class Dimmer extends TuyaDevice {
    constructor(info) {
        super(info)
        this.tuya.on('data', data => {
            if (data.hasOwnProperty('dps')) {
                this.onMessage(data.dps, data.hasOwnProperty('t'))
            }
        })

        this.id = info.id
        this.name = info.name[0]
        this.image = info.image[0]
        this.state = false
        this.brightness = 1000
        this.custom = info.custom
    }

    getState() {
        return { type: 'dimmer', id: this.id, state: this.state, brightness: this.brightness }
    }

    getInfo() {
        return {
            type: 'dimmer', id: this.id, name: this.name, image: this.image,
            state: this.state, brightness: this.brightness
        }
    }

    toggle() {
        this.tuya.set({ set: !this.state, dps: 1 })
    }

    onMessage(data, emit) {
        const info = {}
        if (data.hasOwnProperty('1')) {
            this.state = data['1']
            info.state = data['1']
        }
        if (data.hasOwnProperty('2')) {
            this.brightness = data['2']
            info.brightness = data['2']
        }
        if (emit) {
            this.onData(this.getState(), info)
        }
    }

    command(command) {
        const data = {}
        if (command.hasOwnProperty('state')) {
            data['1'] = command.state
        }
        if (command.hasOwnProperty('brightness')) {
            data['2'] = command.brightness
        }
        this.tuya.set({ multiple: true, data: data })
            .catch(() => console.log('Error'))
    }
}

export class Outlet extends TuyaDevice {
    constructor(info) {
        super(info)
        this.tuya.on('data', data => {
            if (data.hasOwnProperty('dps')) {
                this.onMessage(data.dps, data.hasOwnProperty('t'))
            }
        })

        this.id = info.id
        this.name = info.name[0]
        this.image = info.image[0]
        this.state = false
        this.custom = info.custom
    }

    getState() {
        return { type: 'outlet', id: this.id, state: this.state }
    }

    getInfo() {
        return { type: 'outlet', id: this.id, name: this.name, image: this.image, state: this.state }
    }

    toggle() {
        this.tuya.set({ set: !this.state, dps: 1 })
    }

    onMessage(data, emit) {
        this.state = data['1']
        if (emit) {
            this.onData(this.getState(), { state: data['1'] })
        }
    }

    command(command) {
        if (command.hasOwnProperty('state')) {
            this.tuya.set({ dps: '1', set: command.state })
                .catch(() => console.log('Error'))
        }
    }
}

export class MultiOutlet {
    constructor(info, tuya, index) {
        this.tuya = tuya.tuya
        this.index = index
        this.id = info.id + index
        this.name = info.name[index]
        this.image = info.image[index]
        this.state = false
        this.combine = info.combine
        this.custom = info.custom
        this.number = info.combine ? 1 : info.number
        this.tuya.on('data', data => {
            if (data.hasOwnProperty('dps')) {
                this.onMessage(data.dps, data.hasOwnProperty('t'))
            }
        })
    }

    getState() {
        return { type: 'multioutlet', id: this.id, state: this.state }
    }

    getInfo() {
        return { type: 'multioutlet', id: this.id, name: this.name, image: this.image, state: this.state }
    }

    toggle() {
        if (this.combine) {
            const data = {}
            for (let n = 0; n < this.number; n++) {
                data[n + 1] = !this.state
            }
            this.tuya.set({ multiple: true, data })
        } else {
            this.tuya.set({ set: !this.state, dps: this.index + 1 })
        }
    }

    onMessage(data, emit) {
        if (data.hasOwnProperty(this.index + 1)) {
            this.state = data[this.index + 1]
            if (emit) {
                this.onData(this.getState(), { state: this.state })
            }
        }
    }

    command(command) {
        if (command.hasOwnProperty('state')) {
            if (this.combine) {
                const data = {}
                for (let n = 0; n < this.number; n++) {
                    data[n + 1] = command.state
                }
                this.tuya.set({ multiple: true, data })
            } else {
                this.tuya.set({ set: command.state, dps: this.index + 1 })
            }
        }
    }
}
