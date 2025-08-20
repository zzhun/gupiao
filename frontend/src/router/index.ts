import { createRouter, createWebHistory } from "vue-router";
import StockList from "@/views/StockList.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: StockList,
    },
    {
      path: "/stocks",
      name: "stocks",
      component: StockList,
    },
  ],
});

export default router;
