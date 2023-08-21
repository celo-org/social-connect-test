import { ContractKit } from '@celo/contractkit'
import {
  CombinerEndpoint,
  ErrorType,
  getSignerEndpoint,
  hasValidAccountParam,
  isBodyReasonablySized,
  PnpQuotaRequest,
  PnpQuotaRequestSchema,
  PnpQuotaResponse,
  PnpQuotaResponseFailure,
  PnpQuotaResponseSchema,
  PnpQuotaResponseSuccess,
  PnpQuotaStatus,
  send,
  SignerEndpoint,
  WarningMessage,
} from '@celo/phone-number-privacy-common'
import Logger from 'bunyan'
import { Request, Response } from 'express'
import * as t from 'io-ts'
import { IO } from '../../../common/io'
import { Session } from '../../../common/session'
import { getCombinerVersion, OdisConfig } from '../../../config'

export class PnpQuotaIO extends IO<PnpQuotaRequest> {
  readonly endpoint: CombinerEndpoint = CombinerEndpoint.PNP_QUOTA
  readonly signerEndpoint: SignerEndpoint = getSignerEndpoint(this.endpoint)
  readonly requestSchema: t.Type<PnpQuotaRequest, PnpQuotaRequest, unknown> = PnpQuotaRequestSchema
  readonly responseSchema: t.Type<PnpQuotaResponse, PnpQuotaResponse, unknown> =
    PnpQuotaResponseSchema

  constructor(readonly config: OdisConfig, readonly kit: ContractKit) {
    super(config)
  }

  async init(
    request: Request<{}, {}, unknown>,
    response: Response<PnpQuotaResponse>
  ): Promise<Session<PnpQuotaRequest> | null> {
    if (!super.inputChecks(request, response)) {
      return null
    }
    if (!(await this.authenticate(request, response.locals.logger))) {
      this.sendFailure(WarningMessage.UNAUTHENTICATED_USER, 401, response)
      return null
    }
    const keyVersionInfo = this.getKeyVersionInfo(request, response.locals.logger)
    return new Session(request, response, keyVersionInfo)
  }

  validateClientRequest(
    request: Request<{}, {}, unknown>
  ): request is Request<{}, {}, PnpQuotaRequest> {
    return (
      super.validateClientRequest(request) &&
      hasValidAccountParam(request.body) &&
      isBodyReasonablySized(request.body)
    )
  }

  async authenticate(
    _request: Request<{}, {}, PnpQuotaRequest>,
    _logger: Logger
  ): Promise<boolean> {
    return Promise.resolve(true)
    // return authenticateUser(
    //   request,
    //   this.kit,
    //   logger,
    //   this.config.shouldFailOpen,
    //   [],
    //   this.config.fullNodeTimeoutMs,
    //   this.config.fullNodeRetryCount,
    //   this.config.fullNodeRetryDelayMs
    // )
  }

  sendSuccess(
    status: number,
    response: Response<PnpQuotaResponseSuccess>,
    quotaStatus: PnpQuotaStatus,
    warnings: string[]
  ) {
    send(
      response,
      {
        success: true,
        version: getCombinerVersion(),
        ...quotaStatus,
        warnings,
      },
      status,
      response.locals.logger
    )
  }

  sendFailure(error: ErrorType, status: number, response: Response<PnpQuotaResponseFailure>) {
    send(
      response,
      {
        success: false,
        version: getCombinerVersion(),
        error,
      },
      status,
      response.locals.logger
    )
  }
}
