'use strict'

const electron = require('electron')
const path = require('path')
const url = require('url')

const { BrowserWindow } = electron
const isDevEnv = process.env.NODE_ENV === 'development'

const wins = require('./windows')
const ipcs = require('./ipcs')
const appStates = require('./app-states')
const windowStateKeeper = require('./window-state-keeper')
const createMenu = require('./create-menu')

const pathToLayouts = path.join(__dirname, 'layouts')
const pathToLayoutAppInit = path.join(pathToLayouts, 'app-init.html')

const _createWindow = (
  cb,
  pathname = null,
  winName = 'mainWindow',
  props = {}
) => {
  const point = electron.screen.getCursorScreenPoint()
  const { bounds, workAreaSize } = electron.screen.getDisplayNearestPoint(point)
  const {
    width: defaultWidth,
    height: defaultHeight
  } = workAreaSize
  const isMainWindow = winName === 'mainWindow'
  const {
    width = defaultWidth,
    height = defaultHeight,
    x,
    y,
    isMaximized,
    manage
  } = isMainWindow
    ? windowStateKeeper({
      defaultWidth,
      defaultHeight
    })
    : {}
  const _props = {
    autoHideMenuBar: true,
    width,
    height,
    minWidth: 1000,
    minHeight: 650,
    x: !x
      ? bounds.x
      : x,
    y: !y
      ? bounds.y
      : y,
    icon: path.join(__dirname, '../build/icons/512.png'),
    backgroundColor: '#394b59',
    show: false,
    ...props
  }

  wins[winName] = new BrowserWindow(_props)

  const startUrl = pathname
    ? url.format({
      pathname,
      protocol: 'file:',
      slashes: true
    })
    : 'app://-'

  if (!pathname) {
    appStates.loadURL(wins[winName])
  }

  wins[winName].loadURL(startUrl)

  wins[winName].on('closed', () => {
    wins[winName] = null

    if (
      ipcs.serverIpc &&
      typeof ipcs.serverIpc === 'object'
    ) {
      ipcs.serverIpc.kill('SIGINT')
    }
  })

  wins[winName].once('ready-to-show', () => {
    if (!pathname) {
      createLoadingWindow(cb)

      return
    }

    wins[winName].show()

    if (typeof cb === 'function') {
      cb()
    }
  })

  if (isMainWindow) {
    appStates.isMainWinMaximized = isMaximized

    manage(wins[winName])
  }
}

const _createChildWindow = (
  pathname,
  winName,
  cb,
  {
    width = 500,
    height = 500,
    frame = false
  } = {}
) => {
  const point = electron.screen.getCursorScreenPoint()
  const { bounds } = electron.screen.getDisplayNearestPoint(point)
  const x = Math.ceil(bounds.x + ((bounds.width - width) / 2))
  const y = Math.ceil(bounds.y + ((bounds.height - height) / 2))

  _createWindow(
    cb,
    pathname,
    winName,
    {
      width,
      height,
      minWidth: width,
      minHeight: height,
      x,
      y,
      resizable: false,
      center: true,
      parent: wins.mainWindow,
      frame
    }
  )

  wins[winName].on('closed', () => {
    if (wins.mainWindow) {
      wins.mainWindow.close()
    }

    wins.mainWindow = null
  })
}

const createMainWindow = (cb) => {
  _createWindow(cb)

  if (isDevEnv) {
    wins.mainWindow.webContents.openDevTools()
  }

  createMenu()
}

const createLoadingWindow = (cb) => {
  if (
    wins.loadingWindow &&
    typeof wins.loadingWindow === 'object' &&
    !wins.loadingWindow.isDestroyed() &&
    !wins.loadingWindow.isVisible()
  ) {
    wins.loadingWindow.show()

    if (typeof cb === 'function') {
      cb()
    }
  }

  _createChildWindow(
    pathToLayoutAppInit,
    'loadingWindow',
    cb,
    {
      width: 350,
      height: 350
    }
  )
}

const createErrorWindow = (pathname) => {
  _createChildWindow(
    pathname,
    'errorWindow',
    () => {
      if (wins.loadingWindow) {
        wins.loadingWindow.hide()
      }
    },
    {
      height: 200,
      frame: true
    }
  )
}

module.exports = {
  createMainWindow,
  createLoadingWindow,
  createErrorWindow
}
