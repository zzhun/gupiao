import { createRouter, createWebHistory } from 'vue-router'
import StockList from '@/views/StockList.vue'
import LimitUpStocks from '@/views/LimitUpStocks.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: StockList
    },
    {
      path: '/stocks',
      name: 'stocks',
      component: StockList
    },
    {
      path: '/limit-up',
      name: 'limit-up',
      component: LimitUpStocks
    }
  ]
})

export default router
