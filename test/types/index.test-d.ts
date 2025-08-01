import { expectError, expectType } from 'tsd'
import { PostgrestSingleResponse, createClient } from '../../src/index'
import { Database, Json } from '../types'

const URL = 'http://localhost:3000'
const KEY = 'some.fake.key'
const tealbase = createClient<Database>(URL, KEY)

// table invalid type
{
  expectError(tealbase.from(42))
  expectError(tealbase.from('some_table_that_does_not_exist'))
}

// `null` can't be used with `.eq()`
{
  tealbase.from('users').select().eq('username', 'foo')
  expectError(tealbase.from('users').select().eq('username', null))

  const nullableVar = 'foo' as string | null
  expectError(tealbase.from('users').select().eq('username', nullableVar))
}

// can override result type
{
  const { data, error } = await tealbase
    .from('users')
    .select('*, messages(*)')
    .returns<{ messages: { foo: 'bar' }[] }[]>()
  if (error) {
    throw new Error(error.message)
  }
  expectType<{ foo: 'bar' }[]>(data[0].messages)
}
{
  const { data, error } = await tealbase
    .from('users')
    .insert({ username: 'foo' })
    .select('*, messages(*)')
    .returns<{ messages: { foo: 'bar' }[] }[]>()
  if (error) {
    throw new Error(error.message)
  }
  expectType<{ foo: 'bar' }[]>(data[0].messages)
}

// cannot update non-updatable views
{
  expectError(tealbase.from('updatable_view').update({ non_updatable_column: 0 }))
}

// cannot update non-updatable columns
{
  expectError(tealbase.from('updatable_view').update({ non_updatable_column: 0 }))
}

// json accessor in select query
{
  const { data, error } = await tealbase
    .from('users')
    .select('data->foo->bar, data->foo->>baz')
    .single()
  if (error) {
    throw new Error(error.message)
  }
  // getting this w/o the cast, not sure why:
  // Parameter type Json is declared too wide for argument type Json
  expectType<Json>(data.bar as Json)
  expectType<string>(data.baz)
}

// rpc return type
{
  const { data, error } = await tealbase.rpc('get_status')
  if (error) {
    throw new Error(error.message)
  }
  expectType<'ONLINE' | 'OFFLINE'>(data)
}

// many-to-one relationship
{
  const { data: message, error } = await tealbase.from('messages').select('user:users(*)').single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<Database['public']['Tables']['users']['Row']>(message.user)
}

// one-to-many relationship
{
  const { data: user, error } = await tealbase.from('users').select('messages(*)').single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<Database['public']['Tables']['messages']['Row'][]>(user.messages)
}

// referencing missing column
{
  type SelectQueryError<Message extends string> = { error: true } & Message

  const res = await tealbase.from('users').select('username, dat')
  expectType<
    PostgrestSingleResponse<SelectQueryError<"column 'dat' does not exist on 'users'.">[]>
  >(res)
}

// one-to-one relationship
{
  const { data: channels, error } = await tealbase
    .from('channels')
    .select('channel_details(*)')
    .single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<Database['public']['Tables']['channel_details']['Row'] | null>(
    channels.channel_details
  )
}

// throwOnError in chaining
{
  const { data: channels, error } = await tealbase
    .from('channels')
    .select('channel_details(*)')
    .throwOnError()
  expectType<typeof error>(null)
  expectType<
    {
      channel_details: {
        details: string | null
        id: number
      } | null
    }[]
  >(channels)
}
