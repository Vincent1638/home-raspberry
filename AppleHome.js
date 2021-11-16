const { Accessory, Characteristic, Categories, CharacteristicEventTypes, Service, Bridge, uuid } = require("hap-nodejs");

module.exports = class AppleHome {
    constructor(name) {
        this.bridge = new Bridge(name, uuid.generate("bridge test"))
        this.bridge.publish({
            username: "17:51:07:F4:BC:AE",
            pincode: "111-22-333",
            port: 47129,
            category: Categories.BRIDGE
        })
    }

    addAccessories(accessories) {
        this.bridge.addBridgedAccessories(accessories.map(device => {
            switch (device.type) {
                case 'dimmer':
                    return this.createDimmer(device)
                case 'outlet':
                case 'multioutlet':
                    return this.createOutlet(device)
                case 'sensor':
                    return this.createSensor(device)
                case 'door':
                    return this.createDoor(device)
                case 'button':
                    return this.createButton(device)
                case 'garage':
                    return this.createGarage(device)
            }
        }))
    }

    updateAccessory(info) {
        const UUID = uuid.generate(info.id)
        const accessory = bridge.bridgedAccessories.find(accessory => accessory.UUID === UUID)

        if (info.type == 'dimmer') {
            const service = accessory.getService(Service.Lightbulb)
            const state = service.getCharacteristic(Characteristic.On);
            const brightness = service.getCharacteristic(Characteristic.Brightness);
            state.updateValue(info.state)
            brightness.updateValue(info.brightness / 10)
        }
        else if (info.type == 'outlet' || info.type == 'multioutlet') {
            const service = accessory.getService(Service.Outlet)
            const state = service.getCharacteristic(Characteristic.On);
            state.updateValue(info.state)
        }
        else if (info.type == 'sensor') {
            const service = accessory.getService(Service.MotionSensor)
            const state = service.getCharacteristic(Characteristic.MotionDetected);
            state.updateValue(info.state)
        }
        else if (info.type == 'door') {
            const service = accessory.getService(Service.ContactSensor)
            const state = service.getCharacteristic(Characteristic.ContactSensorState);
            state.updateValue(info.state)
        }
        else if (info.type == 'button') {
            console.log('TODO: Add update to button')
        }
        else if (info.type == 'garage') {
            const states = ['Open', 'Closed', 'Opening', 'Closing']
            const service = accessory.getService(Service.GarageDoorOpener)
            const current = service.getCharacteristic(Characteristic.CurrentDoorState);
            current.updateValue(states.findIndex(state => state === info.data))
        }
    }

    createDimmer(info) {
        const accessory = new Accessory(info.name, uuid.generate(info.id));
        const service = new Service.Lightbulb(info.name);
        const onCharacteristic = service.getCharacteristic(Characteristic.On);
        const brightnessCharacteristic = service.getCharacteristic(Characteristic.Brightness);

        onCharacteristic.on(CharacteristicEventTypes.GET, callback => {
            callback(undefined, info.state);
        });
        onCharacteristic.on(CharacteristicEventTypes.SET, (value, callback) => {
            info.state = value;
            callback();
        });


        brightnessCharacteristic.on(CharacteristicEventTypes.GET, (callback) => {
            callback(undefined, info.brightness / 10);
        });
        brightnessCharacteristic.on(CharacteristicEventTypes.SET, (value, callback) => {
            info.brightness = value * 10;
            callback();
        });

        accessory.addService(service);
        return accessory
    }

    createOutlet(info) {
        const accessory = new Accessory(info.name, uuid.generate(info.id));
        const service = new Service.Outlet(info.name);
        const characteristic = service.getCharacteristic(Characteristic.On);

        characteristic.on(CharacteristicEventTypes.GET, callback => {
            callback(undefined, info.state);
        });

        characteristic.on(CharacteristicEventTypes.SET, (value, callback) => {
            info.state = value;
            callback();
        });

        accessory.addService(service);
        return accessory
    }

    createSensor(info) {
        const accessory = new Accessory(info.name, uuid.generate(info.id));
        const service = new Service.MotionSensor(info.name);
        const characteristic = service.getCharacteristic(Characteristic.MotionDetected);

        characteristic.on(CharacteristicEventTypes.GET, callback => {
            callback(undefined, info.state);
        });

        accessory.addService(service);
        return accessory
    }

    createDoor(info) {
        const accessory = new Accessory(info.name, uuid.generate(info.id));
        const service = new Service.ContactSensor(info.name);
        const characteristic = service.getCharacteristic(Characteristic.ContactSensorState);

        characteristic.on(CharacteristicEventTypes.GET, callback => {
            callback(undefined, info.state);
        });

        accessory.addService(service);
        return accessory
    }

    createButton(info) {
        const accessory = new Accessory(info.name, uuid.generate(info.id));
        const service = new Service.StatelessProgrammableSwitch(info.name);
        const characteristic = service.getCharacteristic(Characteristic.ProgrammableSwitchEvent);

        characteristic.on(CharacteristicEventTypes.GET, callback => {
            callback(undefined, info.state);
        });

        characteristic.on(CharacteristicEventTypes.SET, (value, callback) => {
            info.state = value;
            callback();
        });

        accessory.addService(service);
        return accessory
    }

    createGarage(info) {
        const accessory = new Accessory(info.name, uuid.generate(info.id));
        const service = new Service.GarageDoorOpener(info.name);
        const currentDoorState = service.getCharacteristic(Characteristic.CurrentDoorState);
        const targetDoorState = service.getCharacteristic(Characteristic.TargetDoorState);
        const obstructionDetected = service.getCharacteristic(Characteristic.ObstructionDetected);
        const states = ['Open', 'Closed', 'Opening', 'Closing']

        currentDoorState.on(CharacteristicEventTypes.GET, callback => {
            callback(undefined, states.findIndex(state => state === info.data));
        });

        currentDoorState.on(CharacteristicEventTypes.SET, (value, callback) => {
            info.state = value;
            callback();
        });

        targetDoorState.on(CharacteristicEventTypes.GET, callback => {
            callback(undefined, info.state ? 0 : 1);
        });

        targetDoorState.on(CharacteristicEventTypes.SET, (value, callback) => {
            info.state = value != 1;
            callback();
        });

        obstructionDetected.on(CharacteristicEventTypes.GET, callback => {
            callback(undefined, false);
        });

        accessory.addService(service);
        return accessory
    }
}
