import { structuralCheckoutTemplates } from '../checkout-template-catalog.js';
import { exportTheme } from './contract.mjs';

export const templates = {
  minimal: exportTheme({
    template: 'minimal', layout: 'split', font: 'Inter', contentWidth: 1120,
    primary: '#151515', pageBg: '#f6f6f6', cardBg: '#ffffff', headerBg: '#ffffff',
    textColor: '#171717', pageTextColor: '#171717', headerTextColor: '#171717',
    buttonTextColor: '#ffffff', buttonBgColor: '#151515', borderColor: '#dddddd',
    inputBg: '#ffffff', inputBorderColor: '#777777', radius: 14, inputRadius: 8,
    progressStyle: 'outline', progressActiveColor: '#151515', progressInactiveColor: '#ffffff',
    progressActiveTextColor: '#ffffff', progressInactiveTextColor: '#555555',
    progressLabelColor: '#555555', progressActiveLabelColor: '#171717',
    showProgress: true, showSummary: true, summaryDevice: 'all', buttonEffect: 'none',
    footerBackgroundColor: '#ffffff', footerTextColor: '#171717',
  }, 'Essencial'),
  retail: exportTheme(structuralCheckoutTemplates.retail.preset, 'Varejo'),
  marketplace: exportTheme(structuralCheckoutTemplates.marketplace.preset, 'Marketplace'),
};
