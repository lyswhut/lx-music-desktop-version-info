const { URL } = require('url')
const http = require('http')
const https = require('https')

/**
 * @typedef Options
 * @prop {'get' | 'head' | 'delete' | 'patch' | 'post' | 'put'} method
 * @prop {Record<string, string>} params
 * @prop {Record<string, string>} headers
 * @prop {number} [timeout]
 * @prop {boolean} [json]
 * @prop {http.RequestOptions['lookup']} [lookup]
 * @prop {http.RequestOptions['family']} [family]
 * @prop {http.Agent} [agent]
 */

/**
 * @typedef Response
 * @prop {Record<string, string>} headers
 * @prop {string} body
 * @prop {number} statusCode
 * @prop {string} statusMessage
 */

/**
 * Http Callback
 * @typedef {(err: Error | null, res: Response| null) => void} HttpCallback
 */

/** @type {Options} */
const defaultOptions = {
  method: 'get',
  timeout: 10000
}

/**
 *
 * @param {string} url
 * @param {Options} options
 * @returns
 */
const sendRequest = (url, options) => {
  const urlParse = new URL(url)

  /** @type {http.RequestOptions | https.RequestOptions} */
  const httpOptions = {
    host: urlParse.hostname,
    port: urlParse.port,
    path: urlParse.pathname + urlParse.search,
    method: options.method,
    lookup: options.lookup,
    family: options.family,
  }

  if (options.params) {
    httpOptions.path += `${urlParse.search ? '&' : '?'}${Object.entries(options.params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&')}`
  }

  if (options.headers) httpOptions.headers = { ...options.headers }

  if (options.data) httpOptions.headers['Content-Length'] = options.data.length

  if (options.agent) httpOptions.agent = options.agent

  return urlParse.protocol == 'https:'
    ? https.request(httpOptions)
    : http.request(httpOptions)
}

/**
 * apply timeout
 * @param {http.ClientRequest} request
 * @param {number} time
 */
const applyTimeout = (request, time) => {
  /** @type {NodeJS.Timeout | null} */
  let timeout = setTimeout(() => {
    timeout = null
    if (request.destroyed) return
    request.destroy(new Error('Request timeout'))
  }, time)
  // request.on('response', () => {
  //   if (!timeout) return
  //   clearTimeout(timeout)
  //   timeout = null
  // })
  return () => {
    if (!timeout) return
    clearTimeout(timeout)
    timeout = null
  }
}

// const isRequireRedirect = (response: http.IncomingMessage) => {
//   return response.statusCode &&
//     response.statusCode > 300 &&
//     response.statusCode < 400 &&
//     Object.hasOwn(response.headers, 'location') &&
//     response.headers.location
// }

// export function request(url: string, callback: HttpCallback)
// export function request(url: string, options: Partial<Options>, callback: HttpCallback)
/**
 *
 * @param {string} url
 * @param {Partial<Options>} _options
 * @param {HttpCallback} [callback]
 * @returns
 */
exports.request = (url, _options, callback) => {
  /** @type {Options} */
  let options = { ...defaultOptions, ..._options }
  if (options.data) options.data = Buffer.from(options.data)
  const request = sendRequest(url, options)
  let stopTimeout
  if (options.timeout) stopTimeout = applyTimeout(request, options.timeout)

  request.on('response', (response) => {
    let data = []
    response.on('data', (chunk) => {
      data.push(chunk)
    })
    response.on('end', () => {
      stopTimeout?.()
      data = Buffer.concat(data).toString()
      if (_options.json) {
        try {
          data = JSON.parse(data)
        } catch {}
      }
      callback(null, {
        body: data,
        headers: response.headers,
        statusCode: response.statusCode,
        statusMessage: response.statusMessage,
      })
    })
  })
  request.on('error', (err) => {
    stopTimeout?.()
    callback(err, null)
  })
  request.end(options.data)
  return request
}

exports.requestPromise = (url, options) => new Promise((resolve, reject) => {
  if (options == null) options = {}
  exports.request(url, options, (err, resp) => {
    if (err) {
      reject(err)
    } else resolve(resp.body)
  })
})
