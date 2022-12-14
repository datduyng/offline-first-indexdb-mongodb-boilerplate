import Head from 'next/head'
import Image from 'next/image'
import { memo, useMemo } from 'react'
import { useOfflineSync } from '../libs/offline-service.client'
import { usePullLatestTodo } from '../libs/use-pull-latest-todo'
import { useStore } from '../store'
import styles from '../styles/Home.module.css'


// use Memo to avoid re-rendering
const Sync = memo(function WrapperSync() {
  useOfflineSync();
  return (
    <></>
  );
});

export default function Home(): JSX.Element {
  const [todos, addTodo, setTodos, updateTodo] = useStore(store => [store.todos, store.addTodo, store.setTodos, store.updateTodo]);
  usePullLatestTodo();

  return (
    <div className={styles.container}>
      <Sync />
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <a href="https://github.com/datduyng/offline-first-indexdb-mongodb-boilerplate">Next Offline Starter!</a>
        </h1>
        <div style={{
          marginTop: 40,
        }}>

        </div>
        {/* Add todo input  */}
        <input type="text" onKeyDown={async (e) => {
          if (e.key === 'Enter') {
            addTodo({
              name: e.currentTarget.value,
              done: 0,
              _isDeleted: 0,
              lastModified: Date.now(),
            })
            e.currentTarget.value = ''
          }
        }} />

        <div style={{

          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          marginTop: 10,
        }}>


          {todos.filter(a => !a._isDeleted).map((todo) => (

            <div key={todo.cid} style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: '1rem',
              width: '20rem',
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
              }}>

                <input

                  type="checkbox"
                  checked={!!todo.done}
                  onChange={() => updateTodo(todo.cid!, {
                    done: todo.done == 0 ? 1 : 0,
                  })}
                />
                <div>{todo.name}</div>
              </div>

              {/* remove button */}
              <button onClick={() => updateTodo(todo.cid!, {
                _isDeleted: 1
              })}>x</button>

            </div>
          ))}

        </div>

      </main>

      <footer className={styles.footer}>
      </footer>
    </div>
  )
}
