"use client";

import { useEffect, useState } from "react";

interface RatesCache {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
}

const CACHE_KEY = "subtracker_exchange_rates";
const CACHE_TTL = 60 * 60 * 1000; // 1 heure

async function fetchRates(base: string): Promise<Record<string, number>> {
  const cached = readCache();
  if (cached && cached.base === base && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.rates;
  }

  const response = await fetch(`https://open.er-api.com/v6/latest/${base}`);
  if (!response.ok) throw new Error("Impossible de récupérer les taux de change");
  const data = await response.json();
  if (data.result !== "success") throw new Error("Réponse invalide de l'API de change");

  const cache: RatesCache = {
    base,
    rates: data.rates,
    fetchedAt: Date.now(),
  };
  writeCache(cache);
  return data.rates;
}

function readCache(): RatesCache | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as RatesCache) : null;
  } catch {
    return null;
  }
}

function writeCache(cache: RatesCache) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // stockage indisponible : tant pis, on retentera au prochain chargement
  }
}

export function useExchangeRates(base: string) {
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchRates(base)
      .then((r) => {
        if (active) setRates(r);
      })
      .catch(() => {
        if (active) setError("Taux de change indisponibles pour le moment.");
      });
    return () => {
      active = false;
    };
  }, [base]);

  function convert(amount: number, from: string, to: string): number {
    if (!rates || from === to) return amount;
    // rates est basé sur `base` : amount(from) -> base -> to
    const fromRate = from === base ? 1 : rates[from];
    const toRate = to === base ? 1 : rates[to];
    if (!fromRate || !toRate) return amount;
    return (amount / fromRate) * toRate;
  }

  return { rates, error, convert, isLoading: rates === null && !error };
}
