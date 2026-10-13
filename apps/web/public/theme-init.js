try {
  var theme = localStorage.getItem('jobpilot-theme')
  var dark = theme === 'dark' || ((theme === 'system' || !theme) && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (dark) document.documentElement.classList.add('dark')
} catch {
  /* storage can be blocked */
}
