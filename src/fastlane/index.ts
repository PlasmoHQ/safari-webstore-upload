
import { ConvertWebExtensionAction, ConvertWebExtensionOptions } from "./actions/convert"
import { MatchAction, MatchOptions } from "./actions/match"
import { BuildLane, BuildOptions } from "./lanes/build"
import { PilotLane, PilotOptions } from "./lanes/pilot"
import { DeliverLane, DeliverOptions } from "./lanes/deliver"
import { getVerboseLogger } from "~util/logging"
import { FastlaneAPIKey, APIKey } from "~fastlane/config/auth"
import { FastlaneAppfile, Appfile } from "~fastlane/config/appfile"
import type { CodeSigningOptions } from "~/"
import { CertAction, CertOptions } from "./actions/cert"
import { SighAction, SighOptions } from "./actions/sigh"

const vLog = getVerboseLogger()

export type FastlaneOptions = {
  workspace: string
  key: APIKey
  appfile: Appfile
}

export class FastlaneClient {
  options: FastlaneOptions
  apiKeyPath: string

  constructor(options: FastlaneOptions) {
    this.options = options
  }

  // generate Xcode project with extension folder
  async convert(extension: string, options?: ConvertWebExtensionOptions) {
    const cwd = this.options.workspace
    vLog("Converting extension...")
    const action = new ConvertWebExtensionAction(options, { cwd })
    await action.convert(extension)
    vLog("Xcode project successfully generated")
  }

  // generate hardcoded Appfile
  // auth with developer portal and itunes connect
  async configure(options?: CodeSigningOptions) {
    vLog("Configuring Fastlane...")
    const appfile = new FastlaneAppfile(this.options.appfile)
    await appfile.generate(this.options.workspace)
    const key = new FastlaneAPIKey(this.options.key)
    this.apiKeyPath = await key.writeJSON(this.options.workspace)
    await this.codeSigningSetup(options)
    vLog("Fastlane successfully configured")
  }

  private async codeSigningSetup(options?: CodeSigningOptions) {
    vLog("Gathering codesigning materials...")
    const actionOptions = { cwd: this.options.workspace }
    const types = ["development", "appstore"]
    for (const type of types) {
      vLog(`Gathering codesigning materials for ${type}...`)
      if (options.match) {
        const matchOptions = { api_key_path: this.apiKeyPath, type } as MatchOptions
        const match = new MatchAction(matchOptions, actionOptions)
        await match.syncCodeSigning()
      } else {
        const development = (type === "development")
        const certOptions = { api_key_path: this.apiKeyPath, development } as CertOptions
        const cert = new CertAction(certOptions, actionOptions)
        await cert.getCertificates()
        const sighOptions = { api_key_path: this.apiKeyPath, development } as SighOptions
        const sigh = new SighAction(sighOptions, actionOptions)
        await sigh.getProvisioningProfile()
      }
    }
  }

  // build and sign app
  async build(options?: BuildOptions) {
    const lane = new BuildLane(options)
  }

  // upload and deploy to testflight
  private async pilot(options?: PilotOptions) {
    const lane = new PilotLane(options)
  }

  // upload and submit to the app store
  async deliver(options?: DeliverOptions) {
    const lane = new DeliverLane(options)
  }
}