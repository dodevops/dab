import { AbstractProvisioner } from './AbstractProvisioner'
import Bluebird = require('bluebird')
import { Docker } from 'node-docker-api'
import isDocker = require('is-docker')
import { Container } from 'node-docker-api/lib/container'
import { DojoProvisionerConfiguration } from '../DojoProvisionerConfiguration'
import { Logger, getLogger } from 'loglevel'
import * as path from 'path'

export class DockerProvisioner extends AbstractProvisioner {

  private _docker: Docker
  private _networkId: string
  private _dojoContainerId: string
  private _isDocker: boolean
  private _log: Logger = getLogger('DockerProvisioner')

  public setup (): Bluebird<void> {
    this._docker = new Docker({ socketPath: '/var/run/docker.sock' })
    this._isDocker = isDocker()
    return Bluebird.resolve()
      .then(
        () => {
          return this._docker.network.list({
            filters: '{"label": {"dabNetwork=true":true}}'
          })
        }
      )
      .then(
        networks => {
          if (networks.length > 0) {
            this._networkId = networks[ 0 ].id
            return Bluebird.resolve()
          } else {
            return this._docker.network.create({
              Name: 'dabNetwork',
              Labels: {
                dabNetwork: 'true'
              }
            })
              .then(
                network => {
                  this._networkId = network.id
                }
              )
          }
        }
      )
      .thenReturn()
  }

  public startDefectDojo (config?: DojoProvisionerConfiguration): Bluebird<string> {

    if (!config) {
      config = {
        hostIp: 'localhost',
        port: 8000,
        name: 'dab-dojo',
        localDatabaseStorage: path.join(__dirname, '..', '..', 'db')
      }
    }

    return Bluebird.resolve()
      .then(
        () => {
          return this._docker.container.list({
            all: true,
            filters: '{"label": {"dabDojoContainer=true": true}}'
          })
        }
      )
      .then(
        container => {
          if (container.length > 0) {
            if ((
              container[ 0 ].data as any
            ).State !== 'running') {
              this._log.error(`Found an existing DefectDojo container with id ${container[ 0 ].id}, \
              but it isn't running. I don't know what to do here. Please clean up manually. Exiting.`)
              return Bluebird.reject(new Error('Existing DefectDojo container'))
            }
            this._log.warn(`Found an existing DefectDojo container with id ${container[ 0 ].id}, \
              which seems to be created by DAB. Will use that. Keep your fingers crossed`)
            this._dojoContainerId = container[ 0 ].id
            return Bluebird.resolve()
          } else {
            let containerOpts: any = {
              Image: 'appsecpipeline/django-defectdojo',
              name: config.name,
              Hostname: 'dojo',
              ExposedPorts: {
                '8000/tcp': {}
              },
              Volumes: {
                '/var/lib/mysql': {}
              },
              Labels: {
                dabDojoContainer: 'true'
              },
              HostConfig: {
                Binds: [
                  `${config.localDatabaseStorage}:/var/lib/mysql`
                ]
              }
            }
            if (!this._isDocker) {
              containerOpts.HostConfig.PortBindings = {
                '8000/tcp': [
                  {
                    HostIp: config.hostIp,
                    HostPort: config.port.toString()
                  }
                ]
              }
            }
            return Bluebird.resolve()
              .then(
                () => {
                  return this._docker.container.create(containerOpts)
                }
              )
              .then(
                createdContainer => {
                  this._dojoContainerId = createdContainer.id
                  return createdContainer.start()
                }
              )
              .then(
                () => {
                  return this._docker.network.get(this._networkId)
                }
              )
              .then(
                network => {
                  return network.connect({
                    Container: this._dojoContainerId
                  })
                }
              )
              .thenReturn()
          }
        }
      )
      .then(
        () => {
          if (this._isDocker) {
            return 'http://dojo:8000'
          } else {
            return `http://${config.hostIp}:${config.port}`
          }
        }
      )
  }

  public startZap (port: number): Bluebird<string> {
    return undefined
  }

  public stopDefectDojo (): Bluebird<void> {
    return Bluebird.resolve()
      .then(
        () => {
          return this._docker.container.list({
            all: true,
            filters: '{"label": {"dabDojoContainer=true": true}}'
          })
        }
      )
      .then(
        containers => {
          if (containers.length === 0) {
            this._log.warn('No DefectDojo container found. Ignoring that.')
            return Bluebird.resolve()
          }
          return Bluebird.resolve(containers[ 0 ].delete({
            force: true
          }))
            .thenReturn()
        }
      )
      .then(
        () => {
          return this._docker.network.list({
            filters: '{"label": {"dabNetwork=true":true}}'
          })
        }
      )
      .then(
        networks => {
          if (networks.length === 0) {
            this._log.warn('No DefectDojo network found. Ignoring that.')
            return Bluebird.resolve()
          }
          return Bluebird.resolve(networks[ 0 ].remove())
            .thenReturn()
        }
      )
      .thenReturn()
  }
}
