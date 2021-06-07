'use strict'

const electron = require('electron')
const Alert = require('electron-alert')
const cronValidate = require('cron-validate')
const path = require('path')
const fs = require('fs')

const fontsStyle = fs.readFileSync(path.join(
  __dirname, '../bfx-report-ui/build/fonts/roboto.css'
))
const modalDialogStyle = fs.readFileSync(path.join(
  __dirname, 'modal-dialog-src/modal-dialog.css'
))
const modalDialogScript = fs.readFileSync(path.join(
  __dirname, 'modal-dialog-src/modal-dialog.js'
))

const {
  SyncFrequencyChangingError
} = require('./errors')
const showErrorModalDialog = require('./show-error-modal-dialog')
const pauseApp = require('./pause-app')
const relaunch = require('./relaunch')
const { getConfigsKeeperByName } = require('./configs-keeper')

const _getSchedulerRule = (timeFormat, alertRes) => {
  if (timeFormat.value === 'days') {
    return `0 0 */${alertRes.value} * *`
  }
  if (timeFormat.value === 'hours') {
    return `0 */${alertRes.value} * * *`
  }

  return `*/${alertRes.value} * * * *`
}

const _testTime = (time) => {
  return (
    time &&
    typeof time === 'string' &&
    /^\*\/\d{1,2}$/i.test(time)
  )
}

const _getTime = (timeFormat, time) => {
  return {
    timeFormat,
    value: time.replace('*/', '')
  }
}

const _getTimeDataFromRule = (rule) => {
  const cronResult = cronValidate(rule)

  if (!cronResult.isValid()) {
    return { timeFormat: 'hours', value: 2 }
  }

  const value = cronResult.getValue()

  if (_testTime(value.daysOfMonth)) {
    return _getTime('days', value.daysOfMonth)
  }
  if (_testTime(value.hours)) {
    return _getTime('hours', value.hours)
  }
  if (_testTime(value.minutes)) {
    return _getTime('mins', value.minutes)
  }

  return { timeFormat: 'hours', value: 2 }
}

const fonts = `<style>${fontsStyle}</style>`
const style = `<style>${modalDialogStyle}</style>`
const script = `<script type="text/javascript">${modalDialogScript}</script>`

module.exports = () => {
  const configsKeeper = getConfigsKeeperByName('main')
  const timeFormatAlert = new Alert([fonts, style])
  const alert = new Alert([fonts, style, script])

  const closeTimeFormatAlert = () => {
    if (!timeFormatAlert.browserWindow) return

    timeFormatAlert.browserWindow.close()
  }
  const closeAlert = () => {
    if (!alert.browserWindow) return

    alert.browserWindow.close()
  }

  const timeFormatAlertOptions = {
    title: 'Set time format',
    type: 'question',
    background: '#172d3e',
    customClass: {
      title: 'titleColor',
      content: 'textColor',
      input: 'textColor radioInput'
    },
    focusConfirm: true,
    showCancelButton: true,
    progressSteps: [1, 2],
    currentProgressStep: 0,
    input: 'radio',
    inputValue: 'hours',
    inputOptions: {
      mins: 'Mins',
      hours: 'Hours',
      days: 'Days'
    },
    onBeforeOpen: () => {
      if (!timeFormatAlert.browserWindow) return

      timeFormatAlert.browserWindow.once('blur', closeTimeFormatAlert)
    }
  }
  const alertOptions = {
    title: 'Set sync frequency',
    type: 'question',
    background: '#172d3e',
    customClass: {
      title: 'titleColor',
      content: 'textColor',
      input: 'textColor rangeInput'
    },
    focusConfirm: true,
    showCancelButton: true,
    progressSteps: [1, 2],
    currentProgressStep: 1,
    input: 'range',
    onBeforeOpen: () => {
      if (!alert.browserWindow) return

      alert.browserWindow.once('blur', closeAlert)
    }
  }
  const sound = { freq: 'F2', type: 'triange', duration: 1.5 }

  const getAlertOpts = (timeFormat, timeData) => {
    const { inputOptions } = timeFormatAlertOptions
    const text = inputOptions[timeFormat.value]

    if (timeFormat.value === 'days') {
      return {
        ...alertOptions,
        text,
        inputValue: timeFormat.value === timeData.timeFormat
          ? timeData.value : 1,
        inputAttributes: {
          min: 1,
          max: 31,
          step: 1
        }
      }
    }
    if (timeFormat.value === 'hours') {
      return {
        ...alertOptions,
        text,
        inputValue: timeFormat.value === timeData.timeFormat
          ? timeData.value : 2,
        inputAttributes: {
          min: 1,
          max: 23,
          step: 1
        }
      }
    }

    return {
      ...alertOptions,
      text,
      inputValue: timeFormat.value === timeData.timeFormat
        ? timeData.value : 20,
      inputAttributes: {
        min: 10,
        max: 59,
        step: 1
      }
    }
  }

  return async () => {
    const win = electron.BrowserWindow.getFocusedWindow()
    win.once('closed', closeTimeFormatAlert)
    win.once('closed', closeAlert)

    try {
      const savedSchedulerRule = await configsKeeper
        .getConfigByName('schedulerRule')
      const timeData = _getTimeDataFromRule(savedSchedulerRule)

      const timeFormat = await timeFormatAlert.fireFrameless(
        {
          ...timeFormatAlertOptions,
          inputValue: timeData.timeFormat
        },
        null, true, false, sound
      )
      win.removeListener('closed', closeTimeFormatAlert)

      if (timeFormat.dismiss) {
        return
      }

      const alertRes = await alert.fireFrameless(
        getAlertOpts(timeFormat, timeData),
        null, true, false, sound
      )
      win.removeListener('closed', closeAlert)

      if (alertRes.dismiss) {
        return
      }

      const schedulerRule = _getSchedulerRule(
        timeFormat,
        alertRes
      )

      if (savedSchedulerRule === schedulerRule) {
        return
      }

      await pauseApp()
      const isSaved = await configsKeeper
        .saveConfigs({ schedulerRule })

      if (!isSaved) {
        throw new SyncFrequencyChangingError()
      }

      relaunch()
    } catch (err) {
      try {
        await showErrorModalDialog(win, 'Change sync frequency', err)
      } catch (err) {
        console.error(err)
      }

      console.error(err)
      relaunch()
    }
  }
}
