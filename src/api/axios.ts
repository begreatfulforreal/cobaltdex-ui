import { updateReqHistory } from 'bifido-sdk'
import { toastSubject } from '@/hooks/toast/useGlobalToast'
import i18n from '@/i18n'
import axios from 'axios'
import { sendNetworkEvent } from './event'

const axiosInstance = axios.create({ timeout: 60 * 1000 })
export const retryCount = 5
export const skipRetryStatus = new Set([400, 403, 404, 500])
const logCount = 800

const isSkipLogs = (url?: string) => url?.includes('birdeye')

axiosInstance.interceptors.response.use(
  (response) => {
    // 2xx
    const { config, data, status } = response
    const { url } = config

    if (!isSkipLogs(url)) {
      try {
        updateReqHistory({
          status,
          url: url || '',
          params: config.params,
          data: {
            id: data.id,
            success: data.success
          },
          logCount
        })
      } catch {
        //empty
      }
    }

    return data
  },
  (error) => {
    // https://axios-http.com/docs/handling_errors
    // not 2xx
    const { config, response = {} } = error
    const { status } = response
    const { url } = config

    console.error(`axios request error: ${url}, status:${status || error.code}, msg:${response.message || error.message}`)
    if (!url.includes('monitor'))
      sendNetworkEvent({
        url,
        errorMsg: response.message || error.message
      })
    if (!isSkipLogs(url)) {
      try {
        updateReqHistory({
          status,
          url,
          params: config.params,
          data: {
            id: response.data?.id,
            success: error.message
          },
          logCount
        })
      } catch {
        //empty
      }
    }

    if (!config.skipError)
      toastSubject.next({
        title: i18n.t('error.api_error'),
        description: status || error.message,
        status: 'error'
      })

    return Promise.reject(error)
  }
)

export default axiosInstance
