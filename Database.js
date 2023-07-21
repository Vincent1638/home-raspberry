const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { firebase } = require('./credentials.json')

initializeApp({ credential: cert(firebase) })

const db = getFirestore()
const usersRef = db.collection('users')
const imagesRef = db.collection('images')
const devicesRef = db.collection('devices')
const automationsRef = db.collection('automations')

const addImage = (type, name, svg) => {
  return imagesRef.doc(type).set({ name, svg })
}

const getImages = async () => {
  const snapshot = await imagesRef.get()
  return snapshot.docs.map(doc => doc.data())
}

const updateUserData = (username, data) => {
  return usersRef.doc(username).update(data)
}

const getUserData = async username => {
  const doc = await usersRef.doc(username).get()
  return doc.data()
}

const getDevices = async custom => {
  const snapshot = await devicesRef.where('custom', '==', custom).get()
  return snapshot.docs.map(doc => doc.data())
}

const upsertDevice = async (device, custom) => {
  return devicesRef.doc(device.id).set({ ...device, custom }, { merge: true })
}

const deleteDevice = id => {
  return devicesRef.doc(id).delete()
}

const updateDeviceInfo = (id, info) => {
  return devicesRef.doc(id).update(info)
}

const getAutomations = async () => {
  const snapshot = await automationsRef.get()
  return snapshot.docs.map(doc => doc.data())
}

const deleteAutomation = id => {
  return automationsRef.doc(id).delete()
}

const upsertAutomation = async automation => {
  if (automation.id !== '') {
    return automationsRef.doc(automation.id).set(automation)
  } else {
    const { id } = await automationsRef.add(automation)
    return automationsRef.doc(id).update({ id })
  }
}

module.exports = {
  addImage,
  getImages,
  updateUserData,
  getUserData,
  getDevices,
  upsertDevice,
  deleteDevice,
  updateDeviceInfo,
  getAutomations,
  upsertAutomation,
  deleteAutomation,
}
