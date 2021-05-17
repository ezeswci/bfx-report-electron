'use strict'

const renderMarkdownTemplate = require('./render-markdown-template')
const openNewGithubIssue = require('./open-new-github-issue')
const collectLogs = require('./collect-logs')
const getDebugInfo = require('../helpers/get-debug-info')

const manageNewGithubIssue = async () => {
  try {
    const debugInfo = getDebugInfo()
    const logs = await collectLogs()

    const mdIssue = renderMarkdownTemplate({
      mainLog: 'Empty',
      workerErrors: 'Empty',
      workerExceptions: 'Empty',
      ...debugInfo,
      ...logs
    })

    openNewGithubIssue({
      title: '[BUG REPORT]',
      body: mdIssue
    })
  } catch (err) {
    console.error(err)
  }
}

module.exports = {
  manageNewGithubIssue
}