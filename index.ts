#!/usr/bin/env node

import { DockerProvisioner } from './lib/provisioner/DockerProvisioner'
import { createProxyServer } from 'http-proxy'
import * as express from 'express'
import Bluebird = require('bluebird')
import { getLogger } from 'loglevel'
import * as terminus from '@godaddy/terminus'
import * as http from 'http'

let provisioner = new DockerProvisioner()
let proxyMiddleware = createProxyServer()
let log = getLogger('dab')

provisioner.setup()
  .then(
    () => {
      return provisioner.startDefectDojo()
    }
  )
  .then(
    (dojourl) => {
      let app = express()
      app.get(
        '/dab/health', (req, res) => {
          res.status(200)
        }
      )
      app.all(
        '/*', (req, res) => {
          proxyMiddleware.web(req, res, { target: dojourl })
        }
      )
      let server = http.createServer(app)
      terminus(server,
        {
          signals: ['SIGINT', 'SIGTERM'],
          onShutdown: () => {
            return Promise.resolve(provisioner.stopDefectDojo().thenReturn(null))
          }
        }
      )
      server.listen(8001)
    }
  )
