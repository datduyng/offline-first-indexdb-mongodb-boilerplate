import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useCreateStore, ZustandProvider } from '../store'

export default function App({ Component, pageProps }: AppProps) {
  const createStore = useCreateStore({} as any);

  return <ZustandProvider createStore={createStore}>
    <Component {...pageProps} />
  </ZustandProvider>
}
