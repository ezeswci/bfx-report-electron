'use strict'

const {
  dialog,
  remote,
  shell,
  clipboard,
  BrowserWindow
} = require('electron')
const path = require('path')

const getDebugInfo = require('./helpers/get-debug-info')

module.exports = () => {
  const _dialog = dialog || remote.dialog

  return async () => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      const {
        detail,
        repositoryUrl,
        productName
      } = getDebugInfo()

      const {
        response: btnId
      } = await _dialog.showMessageBox(
        win,
        {
          type: 'info',
          title: productName,
          message: productName,
          detail,
          buttons: ['Copy', 'GitHub', 'OK'],
          defaultId: 2,
          cancelId: 2,
          icon: path.join(__dirname, '../build/icons/64x64.png')
        }
      )

      if (btnId === 2) {
        return
      }
      if (btnId === 1) {
        shell.openExternal(repositoryUrl)
      }

      clipboard.writeText(detail)
    } catch (err) {
      console.error(err)
    }
  }
}
