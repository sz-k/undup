const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const statAsync = promisify(fs.stat)

const args = process.argv.slice(2)

// stackoverflow to the rescue
const walkCb = (dir, recursive, done) => {
  let results = []
  fs.readdir(dir, (err, list) => {
    if (err) {
      return done(err)
    }
    let pending = list.length
    if (!pending) {
      return done(null, results)
    }
    list.forEach((file) => {
      file = path.resolve(dir, file)
      fs.stat(file, (err, stat) => {
        if (recursive && stat && stat.isDirectory()) {
          walkCb(file, recursive, (err, res) => {
            results.push(...res)
            if (!--pending) {
              done(null, results)
            }
          })
        } else {
          results.push(file)
          if (!--pending) {
            done(null, results)
          }
        }
      })
    })
  })
}

const walk = (dir, recursive) => new Promise((resolve, reject) =>
  walkCb(dir, recursive, (err, results) => err ? reject(err) : resolve(results)))

const deleteFiles = (files) => Promise.all(files.map(fn =>
  new Promise((resolve, reject) => fs.unlink(fn, (err) => err ? reject(err) : resolve()))
))

// for me it's good enough
const isDuplicate = (fn) => {
  const exists = fs.existsSync
  const fnParts = fn.split(path.sep)
  const fnLastPart = fnParts.pop()
  const origFn = [
    ...fnParts,
    fnLastPart
      .replace(/ - (Copy|Copy (\d+)\))/, '')
      .replace(/\s+\(\d+\)/g, '')
  ].join(path.sep)

  if (!exists(origFn)) {
    return false
  }
  return Promise.all([statAsync(fn), statAsync(origFn)]) // so fast, very async
    .then(results => results[0].size === results[1].size)
}

async function asyncApply (asyncFn, args, msg, exitCode) {
  let result
  try {
    result = await asyncFn(...(args || []))
  } catch (err) {
    console.error(msg || 'Error', err)
    if (exitCode) {
      process.exit(exitCode)
    }
  }
  return result
}

;(async function app () {
  if (!args.length) {
    console.info('Usage: node . [options] dir(s)\n' + 'available options:\n' + '--r or --recursive')
    return
  }

  // get params (recursive or not)
  const params = args.filter(arg => arg.startsWith('--')).map(arg => arg.replace(/^--/, ''))
  const recursive = params.includes('r') || params.includes('recursive')

  // get target folders
  const paths = args.filter(arg => !arg.startsWith('--')) // always start with . pls

  // process folders one by one
  for (let i = 0; i < paths.length; i++) {
    const target = path.normalize(paths[i] || '.')
    console.info(`Folder ${target}:`)

    // get all the filenames in this folder
    let files = await asyncApply(walk, [target, recursive], 'File access error.', 1)

    // filter for filenames that look a bit like duplicates
    files = files.filter(fn =>
      / - Copy/.test(fn) || // windows, English
      / - Copy \([^)]*\)/.test(fn) || // windows, English, more than one
      /\(\d+\)/.test(fn) // firefox downloads
    )

    const duplicates = await asyncApply(async function () { return Promise.all(files.filter(isDuplicate))})
    console.info(`Found ${duplicates.length} file(s).`)

    await asyncApply(deleteFiles, [duplicates], 'Could not delete file.')
  }
}())
