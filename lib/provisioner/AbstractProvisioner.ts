import Bluebird = require('bluebird')
import { DojoProvisionerConfiguration } from '../DojoProvisionerConfiguration'

/**
 * A interface for provisioners used by DAB
 */
export abstract class AbstractProvisioner {

  /**
   * Let the provisioner set itself up
   */
  public abstract setup (): Bluebird<void>

  /**
   * Start the defect dojo container and return the URL to it.
   * @param port Optional port to bind defect dojo to (defaults to 8000)
   */
  public abstract startDefectDojo (config?: DojoProvisionerConfiguration): Bluebird<string>

  /**
   * Stop the defect dojo container
   */
  public abstract stopDefectDojo (): Bluebird<void>

  /**
   * Start a ZAP container, that listens to the given port. Return the URL to the API of the ZAP.
   *
   * @param port the port number, ZAP should listen to
   */
  public abstract startZap (port: number): Bluebird<string>
}
