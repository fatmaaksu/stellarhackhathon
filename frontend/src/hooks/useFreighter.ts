import { useCallback, useEffect, useState } from "react";
import {
  getAddress,
  getNetwork,
  isAllowed,
  isConnected,
  setAllowed,
} from "@stellar/freighter-api";

export type WalletStatus = "idle" | "connecting" | "connected" | "error";

export interface FreighterState {
  status: WalletStatus;
  address: string | null;
  network: string | null;
  error: string | null;
  isInstalled: boolean;
}

export function useFreighter() {
  const [state, setState] = useState<FreighterState>({
    status: "idle",
    address: null,
    network: null,
    error: null,
    isInstalled: false,
  });

  useEffect(() => {
    checkInstalled();
  }, []);

  const checkInstalled = async () => {
    const connection = await isConnected();
    if (!connection.isConnected) {
      setState((current) => ({ ...current, isInstalled: false }));
      return;
    }

    setState((current) => ({ ...current, isInstalled: true }));

    const allowed = await isAllowed();
    if (!allowed.isAllowed) return;

    try {
      const address = await getAddress();
      const network = await getNetwork();
      if (!address.error && !network.error) {
        setState({
          status: "connected",
          address: address.address,
          network: network.network,
          error: null,
          isInstalled: true,
        });
      }
    } catch {
      setState((current) => ({ ...current, status: "idle" }));
    }
  };

  const connect = useCallback(async (): Promise<string | null> => {
    setState((current) => ({ ...current, status: "connecting", error: null }));

    try {
      const connection = await isConnected();
      if (!connection.isConnected) {
        setState((current) => ({
          ...current,
          status: "error",
          error: "Freighter yüklü değil. Tarayıcı eklentisini kurup sayfayı yenile.",
          isInstalled: false,
        }));
        return null;
      }

      await setAllowed();
      const address = await getAddress();
      const network = await getNetwork();

      if (address.error) throw new Error("Freighter adresi alınamadı.");
      if (network.error) throw new Error("Freighter ağ bilgisi alınamadı.");

      setState({
        status: "connected",
        address: address.address,
        network: network.network,
        error: null,
        isInstalled: true,
      });

      return address.address;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Freighter bağlantısı başarısız.";
      setState((current) => ({ ...current, status: "error", error: message }));
      return null;
    }
  }, []);

  const disconnect = useCallback(() => {
    setState((current) => ({
      ...current,
      status: "idle",
      address: null,
      network: null,
      error: null,
    }));
  }, []);

  return { ...state, connect, disconnect };
}
