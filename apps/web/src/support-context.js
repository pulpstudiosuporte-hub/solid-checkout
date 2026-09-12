import { createContext, useContext } from 'react';
export const SupportContext = createContext(null);
export const useSupportAccess = () => useContext(SupportContext);
