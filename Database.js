const { Client } = require('pg')

const upsertDeviceQuery = 'INSERT INTO devices(id, type, name, image, key, ip, data, custom) VALUES($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET type = $2, name = $3, image = $4, key = $5, ip = $6, data = $7 RETURNING *;'
const addAutomationQuery = 'INSERT INTO automations(enabled, trigger, sequence) VALUES($1, $2, $3) RETURNING *;'
const updateAutomationQuery = 'UPDATE automations SET enabled = $2, trigger = $3, sequence = $4 WHERE id=$1 RETURNING *;'

module.exports = class Database {
    constructor(data) {
        this.client = new Client(data)
        this.client.connect()
    }

    updateUserMode(username, mode) {
        return this.client.query('UPDATE users SET mode = $2 WHERE username = $1', [username, mode])
    }

    updateUserLayout(username, layout) {
        return this.client.query('UPDATE users SET layout = $2 WHERE username = $1', [username, layout])
    }

    async getUserData(username) {
        const res = await this.client.query('SELECT * FROM users WHERE username = $1 LIMIT 1', [username])
        return res.rows[0]
    }

    async getAutomations() {
        const res = await this.client.query('SELECT * FROM automations ORDER BY id asc')
        return res.rows
    }

    async getDevices(custom) {
        const res = await this.client.query('SELECT * FROM devices WHERE custom=$1', [custom])
        return res.rows
    }

    async upsertDevice(device, custom) {
        const values = [device.id, device.type, device.name, device.image, device.key, device.ip, device.data, custom]
        const res = await this.client.query(upsertDeviceQuery, values)
        return res.rows[0]
    }

    updateDeviceKey(id, key, ip) {
        return this.client.query('UPDATE devices SET key = $2 WHERE id = $1', [id, key])
    }

    updateDeviceData(id, data) {
        return this.client.query('UPDATE devices SET data = $2 WHERE id = $1', [id, data])
    }

    async deleteRow(table, id) {
        return this.client.query(`DELETE FROM ${table} WHERE id='${id}'`)
    }

    async upsertAutomation(automation) {
        let res
        if (automation.id && automation.id !== '') {
            const values = [automation.id, automation.enabled, automation.trigger, automation.sequence]
            res = await this.client.query(updateAutomationQuery, values)
        } else {
            const values = [automation.enabled, automation.trigger, automation.sequence]
            res = await this.client.query(addAutomationQuery, values)
        }
        return res.rows[0]
    }
}