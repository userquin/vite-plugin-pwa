<script setup lang="ts">
import { ref, computed, onBeforeMount } from 'vue'
import { useTimeAgo } from '@vueuse/core'
import MyWorker from './my-worker?worker'

import ReloadPrompt from './ReloadPrompt.vue'

const pong = ref(null)
const mode = ref(null)
const cat = ref(null)
const worker = new MyWorker()
const catImage = computed(() => {
  if (cat.value) return `https://http.cat/${cat.value}`
  else return null
})

// replaced dyanmicaly
const date = '__DATE__'
const timeAgo = useTimeAgo(date)

const runWorker = async() => {
  worker.postMessage('ping')
}
const resetMessage = async() => {
  worker.postMessage('clear')
}
const messageFromWorker = async({ data: { msg, mode: useMode } }) => {
  pong.value = msg
  mode.value = useMode
}

onBeforeMount(() => {
  worker.addEventListener('message', messageFromWorker)
})
</script>

<template>
  <img src="/favicon.svg" width="60" height="60">
  <br>
  <div>Built at: {{ date }} ({{ timeAgo }})</div>
  <br>
  <router-view />
  <br />
  <br />
  <button @click="runWorker">
    Ping web worker
  </button>
  &#160;&#160;
  <button @click="resetMessage">
    Reset message
  </button>
  <br />
  <br />
  <template v-if="pong">
    Response from web worker: <span> Message: {{ pong }} </span>&#160;&#160;<span> Using ENV mode: {{ mode }}</span>
  </template>
  <br />
  <br />
  <div class="cats">
    Test third party requests:
    <div class="actions">
      <button @click="cat = '101'">
        Cat 101
      </button>
      <button @click="cat = '200'">
        Cat 200
      </button>
      <button @click="cat = '305'">
        Cat 305
      </button>
      <button @click="cat = '401'">
        Cat 401
      </button>
      <button @click="cat = '404'">
        Cat 404
      </button>
      <button @click="cat = '500'">
        Cat 500
      </button>
    </div>
    <div v-if="cat">
      <img :key="`cat-${cat}`" :src="catImage" :title="`Cat for status ${cat}`" width="200" height="200">
    </div>
  </div>
  <ReloadPrompt />
</template>
