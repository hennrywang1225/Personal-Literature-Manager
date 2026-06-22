import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('literature', {
  version: '0.1.0'
})
