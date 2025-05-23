import { useEffect, useMemo } from 'react'
import { ApiV3PoolInfoItem, FetchPoolParams, PoolFetchType } from 'bifido-sdk'
import useSWR, { KeyedMutator } from 'swr'
import shallow from 'zustand/shallow'
import { AxiosResponse } from 'axios'
import axios from '@/api/axios'
import { isValidPublicKey } from '@/utils/publicKey'
import { MINUTE_MILLISECONDS } from '@/utils/date'

import { ConditionalPoolType } from './type'
import { useAppStore, useTokenStore } from '@/store'
import { formatPoolData, poolInfoCache, formatAprData } from './formatter'
import { ANTIJEET_API } from '@/features/Swap/util'

const fetcher = ([url]: [url: string]) => axios.get<ApiV3PoolInfoItem[]>(url, { skipError: true })

export default function useFetchPoolById<T = ApiV3PoolInfoItem>(
  props: {
    shouldFetch?: boolean
    idList?: (string | undefined)[]
    refreshInterval?: number
    readFromCache?: boolean
    refreshTag?: number
    keepPreviousData?: boolean
  } & FetchPoolParams
): {
  data?: T[]
  dataMap: { [key: string]: T }
  formattedData?: ConditionalPoolType<T>[]
  formattedDataMap: { [key: string]: ConditionalPoolType<T> }
  isLoading: boolean
  error?: any
  isEmptyResult: boolean
  isValidating: boolean
  mutate: KeyedMutator<AxiosResponse<ApiV3PoolInfoItem[], any>>
} {
  const {
    shouldFetch = true,
    idList = [],
    refreshInterval = MINUTE_MILLISECONDS * 3,
    readFromCache,
    type,
    refreshTag,
    keepPreviousData
  } = props || {}
  const readyIdList = idList.filter((i) => i && isValidPublicKey(i) && !useTokenStore.getState().tokenMap.get(i)) as string[]
  const [host, searchIdUrl] = useAppStore((s) => [ANTIJEET_API, s.urlConfigs.POOL_SEARCH_BY_ID], shallow)

  const cacheDataList = useMemo(
    () =>
      readFromCache
        ? readyIdList
            .map((id) => poolInfoCache.get(id))
            .filter(
              (d) => d !== undefined && (!type || type === PoolFetchType.All || type.toLocaleLowerCase() === d.type.toLocaleLowerCase())
            )
        : [],
    [JSON.stringify(readyIdList)]
  ) as ApiV3PoolInfoItem[]

  const url = !readyIdList.length || readyIdList.length === cacheDataList.length || !shouldFetch ? null : host + searchIdUrl

  const { data, isLoading, error, ...rest } = useSWR(url ? [url + `?ids=${readyIdList.join(',')}`, refreshTag] : null, fetcher, {
    dedupingInterval: refreshInterval,
    focusThrottleInterval: refreshInterval,
    refreshInterval,
    keepPreviousData
  })
  const resData = useMemo(
    () => [
      ...cacheDataList,
      ...(data?.data.filter(
        (d) => !!d && (!type || type === PoolFetchType.All || type.toLocaleLowerCase() === d.type.toLocaleLowerCase())
      ) || [])
    ],
    [data, cacheDataList, type]
  )
  const dataMap = useMemo(() => resData.reduce((acc, cur) => ({ ...acc, [cur.id]: cur }), {}), [resData]) as {
    [key: string]: T
  }
  const formattedData = useMemo(() => (resData ? resData.map(formatPoolData) : undefined), [resData]) as ConditionalPoolType<T>[]
  const formattedDataMap = useMemo(() => formattedData.reduce((acc, cur) => ({ ...acc, [cur.id]: cur }), {}), [formattedData]) as {
    [key: string]: ConditionalPoolType<T>
  }
  const isEmptyResult = !!idList.length && !isLoading && (!data || !resData.length || !!error)

  useEffect(() => {
    if (resData) resData.forEach((d) => poolInfoCache.set(d.id, d))
  }, [resData])

  return {
    data: data?.data.filter(Boolean).map(formatAprData) as T[],
    dataMap,
    formattedData,
    formattedDataMap,
    isLoading,
    error,
    isEmptyResult,
    ...rest
  }
}
