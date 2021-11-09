const axios = require('axios');
const Device = require('./Device');

module.exports = class Automation {

    static automations;
    static sunTimes = {};

    constructor(automations) {
        let enabledAutomations = []
        automations.forEach(automation => {
            if (automation.enabled) {
                enabledAutomations.push(automation)
            }
        })

        Automation.automations = enabledAutomations;
        Automation.sunAutomations = [];
        Automation.updateSun();

        const date = new Date();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0)

        setTimeout(() => {
            Automation.updateSun();
            setInterval(() => { Automation.updateSun() }, 24 * 60 * 60 * 1000);
        }, midnight - date);
    }

    static async updateSun() {
        console.log('Sun automations updated.')
        const response = await axios.get('https://api.sunrise-sunset.org/json?lat=46.114430&lng=-64.847092&formatted=0');
        const sunrise = Date.parse(response.data.results.sunrise);
        const sunset = Date.parse(response.data.results.sunset);
        const date = Date.now();

        const parseSunrise = new Date(sunrise);
        const parseSunset = new Date(sunset);

        Automation.sunTimes = {
            sunrise: parseSunrise.getHours() + parseSunrise.getMinutes() / 60,
            sunset: parseSunset.getHours() + parseSunset.getMinutes() / 60
        };

        Automation.sunAutomations.forEach(clearTimeout);
        Automation.sunAutomations = [];

        Automation.automations.forEach(automation => {
            let offset;
            let diff;

            switch (automation.trigger.type) {
                case 'sunset':
                    offset = automation.trigger.offset * 1000 || 0;
                    diff = sunset - date + offset;

                    if (diff > 0) {
                        Automation.sunAutomations.push(setTimeout(() => {
                            Automation.checkSequence(automation.sequence)
                        }, diff));
                    }
                    break;

                case 'sunrise':
                    offset = automation.trigger.offset * 1000 || 0;
                    diff = sunrise - date + offset;

                    if (diff > 0) {
                        Automation.sunAutomations.push(setTimeout(() => {
                            Automation.checkSequence(automation.sequence)
                        }, diff));
                    }
                    break;

                case 'time':
                    let time = new Date(date);
                    time.setHours(automation.trigger.time.split(':')[0]);
                    time.setMinutes(automation.trigger.time.split(':')[1]);
                    time.setSeconds(0);
                    diff = time.getTime() - date;

                    if (diff > 0) {
                        Automation.sunAutomations.push(setTimeout(() => {
                            Automation.checkSequence(automation.sequence)
                        }, diff));
                    }
                    break;
            }
        })
    }

    static check(info, data) {
        const date = new Date();
        const time = date.getHours() + date.getMinutes() / 60;
        Automation.automations.forEach(auto => {
            if (auto.trigger.type == 'device' && auto.trigger.device == info.id && auto.trigger.state == data.state) {
                const times = Automation.parseTimes(auto.trigger.time || '00:00 - 24:00')
                if (times.start < times.end && times.start <= time && time <= times.end) {
                    Automation.checkSequence(auto.sequence);
                } else if (times.start > times.end && (times.start <= time || time <= times.end)) {
                    Automation.checkSequence(auto.sequence);
                }
            }
        })
    }

    static parseTimes(triggerTime) {
        let start;
        let end;
        let times = triggerTime.toLowerCase().replace(/\s+/g, '').split('-');

        if (times[0] == 'sunrise') {
            start = Automation.sunTimes.sunrise
        } else if (times[0] == 'sunset') {
            start = Automation.sunTimes.sunset
        } else {
            start = parseInt(times[0].split(':')[0]) + parseInt(times[0].split(':')[1]) / 60;
        }

        if (times[1] == 'sunrise') {
            end = Automation.sunTimes.sunrise
        } else if (times[1] == 'sunset') {
            end = Automation.sunTimes.sunset
        } else {
            end = parseInt(times[1].split(':')[0]) + parseInt(times[1].split(':')[1]) / 60;
        }
        return { start, end }
    }

    static async checkSequence(sequence) {
        for (let item of sequence) {
            switch (item.type) {
                case 'device':
                    item.device.forEach(id => {
                        Device.getDevice(id).command(item)
                    })
                    break

                case 'if': {
                    let deviceinfo = Device.getDevice(item.if.device).info;
                    if (deviceinfo.state == item.if.state) {
                        Automation.checkSequence(item.then)
                    }
                }
                    break

                case 'ifElse': {
                    let deviceinfo = Device.getDevice(item.if.device).info;
                    if (deviceinfo.state == item.if.state) {
                        Automation.checkSequence(item.then)
                    } else {
                        Automation.checkSequence(item.else)
                    }
                }
                    break

                case 'wait':
                    await new Promise(resolve => {
                        setTimeout(resolve, item.wait * 1000);
                    })
                    break
            }
        }
    }
}