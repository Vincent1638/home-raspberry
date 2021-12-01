const TuyAPI = require('tuyapi');

module.exports = class Device {
    static devices = []

    constructor(info) {
        info.forEach(i => {
            this.createDevice(i)
        })
    }

    createDevice(info) {
        const tuya = new TuyAPI({ id: info.id, key: info.key, ip: info.ip, version: 3.3 })
        tuya.start = async function () {
            try {
                await this.find()
                await this.connect()
            } catch (e) {
                setTimeout(() => this.start(), 20000)
            }
        }
        tuya.on('disconnected', () => {
            console.log('Disconnected:', info.id)
            setTimeout(() => tuya.start(), 20000)
        })
        tuya.on('error', () => {
            console.log('Error:', info.id)
        })
        tuya.start()

        switch (info.type) {
            case 'multioutlet':
                const test = info.combine ? 1 : info.number
                for (let i = 0; i < test; i++) {
                    const multioutlet = {
                        tuya: tuya,
                        info: {
                            type: 'multioutlet', id: info.id + i, name: info.name[i],
                            image: info.image[i], state: false
                        },
                        toggle: function () {
                            if (info.combine) {
                                const data = {}
                                for (let n = 0; n < info.number; n++) {
                                    data[n + 1] = !this.info.state
                                }
                                this.tuya.set({ multiple: true, data })
                            } else {
                                this.tuya.set({ set: !this.info.state, dps: i + 1 })
                            }
                        },
                        onMessage: function (data, emit) {
                            if (data.hasOwnProperty(i + 1)) {
                                this.info.state = data[i + 1]
                                if (emit) {
                                    this.onData(this.info, { state: this.info.state })
                                }
                            }
                        },
                        command: function (command) {
                            if (command.hasOwnProperty('state')) {
                                if (info.combine) {
                                    const data = {}
                                    for (let n = 0; n < info.number; n++) {
                                        data[n + 1] = command.state
                                    }
                                    this.tuya.set({ multiple: true, data })
                                } else {
                                    this.tuya.set({ set: command.state, dps: i + 1 })
                                }
                            }
                        }
                    }
                    multioutlet.tuya.on('data', data => {
                        if (data.hasOwnProperty('dps')) {
                            multioutlet.onMessage(data.dps, data.hasOwnProperty('t'))
                        }
                    })
                    Device.devices.push(multioutlet)
                }
                break

            case 'dimmer':
                const dimmer = {
                    tuya: tuya,
                    info: {
                        type: 'dimmer', id: info.id, name: info.name[0],
                        image: info.image[0], state: false, brightness: 1000
                    },
                    toggle: function () {
                        this.tuya.set({ set: !this.info.state, dps: 1 })
                    },
                    onMessage: function (data, emit) {
                        const info = {}
                        if (data.hasOwnProperty('1')) {
                            this.info.state = data['1']
                            info.state = data['1']
                        }
                        if (data.hasOwnProperty('2')) {
                            this.info.brightness = data['2']
                            info.brightness = data['2']
                        }
                        if (emit) {
                            this.onData(this.info, info)
                        }
                    },
                    command: function (command) {
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
                dimmer.tuya.on('data', data => {
                    if (data.hasOwnProperty('dps')) {
                        dimmer.onMessage(data.dps, data.hasOwnProperty('t'))
                    }
                })
                Device.devices.push(dimmer)
                break

            case 'outlet':
                const outlet = {
                    tuya: tuya,
                    info: {
                        type: 'outlet', id: info.id, name: info.name[0],
                        image: info.image[0], state: false
                    },
                    toggle: function () {
                        this.tuya.set({ set: !this.info.state, dps: 1 })
                    },
                    onMessage: function (data, emit) {
                        this.info.state = data['1']
                        if (emit) {
                            this.onData(this.info, { state: data['1'] })
                        }
                    },
                    command: function (command) {
                        if (command.hasOwnProperty('state')) {
                            this.tuya.set({ dps: '1', set: command.state })
                                .catch(() => console.log('Error'))
                        }
                    }
                }
                outlet.tuya.on('data', data => {
                    if (data.hasOwnProperty('dps')) {
                        outlet.onMessage(data.dps, data.hasOwnProperty('t'))
                    }
                })
                Device.devices.push(outlet)
                break
        }
    }

    static async findIps(data) {
        const device = new TuyAPI(data)
        const info = await device.find({ all: true })
        return Object.fromEntries(info.map(({ id, ip }) => [id, ip]))
    }

    static getDevice(id) {
        return Device.devices.find(device => device.info.id == id)
    }
}