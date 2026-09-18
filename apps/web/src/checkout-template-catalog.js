// Structural models share the same cart, customer, shipping and Pix flow.
export const structuralCheckoutTemplates = {
  retail: {
    name: 'Varejo · três colunas',
    description: 'Produtos, formulário central e resumo. Etapas em faixas.',
    preset: {
      template: 'retail', layout: 'split', font: 'Arial', contentWidth: 1100,
      primary: '#111111', pageBg: '#ffffff', cardBg: '#fafafa', headerBg: '#ffffff',
      textColor: '#111111', pageTextColor: '#111111', headerTextColor: '#111111',
      buttonTextColor: '#ffffff', borderColor: '#dddddd', inputBg: '#ffffff',
      radius: 0, inputRadius: 8, inputBorderColor: '#888888', buttonBgColor: '#111111',
      progressStyle: 'chevrons', progressActiveColor: '#111111', progressInactiveColor: '#d5d5d5',
      progressActiveTextColor: '#ffffff', progressInactiveTextColor: '#555555',
      progressLabelColor: '#555555', progressActiveLabelColor: '#111111',
      showProgress: true, showSummary: true, summaryDevice: 'all', timer: false,
      buttonEffect: 'none', buttonText: 'Continuar', footerBackgroundColor: '#ffffff', footerTextColor: '#111111',
    },
  },
  marketplace: {
    name: 'Marketplace · cartões',
    description: 'Formulário em cartões e resumo lateral com ação de pagamento.',
    preset: {
      template: 'marketplace', layout: 'split', font: 'Arial', contentWidth: 1100,
      primary: '#2467cc', pageBg: '#ffffff', cardBg: '#ffffff', headerBg: '#ffe600',
      textColor: '#262626', pageTextColor: '#262626', headerTextColor: '#262626',
      buttonTextColor: '#ffffff', borderColor: '#e5e5e5', inputBg: '#ffffff',
      radius: 16, inputRadius: 8, inputBorderColor: '#888888', buttonBgColor: '#2467cc',
      progressStyle: 'icons', progressActiveColor: '#2467cc', progressInactiveColor: '#ffffff',
      progressActiveTextColor: '#2467cc', progressInactiveTextColor: '#595959',
      progressLabelColor: '#595959', progressActiveLabelColor: '#262626',
      showProgress: true, showSummary: true, summaryDevice: 'all', timer: false,
      buttonEffect: 'none', buttonText: 'Continuar', footerBackgroundColor: '#ffffff', footerTextColor: '#262626',
    },
  },
};
