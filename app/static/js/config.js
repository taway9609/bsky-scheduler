// js/config.js
const AppConfig = {
  currentSection: 'posts',
  currentSearchTerm: '',
  currentAccountFilter: 'all',
  currentStatusFilter: 'all',
  currentSortBy: 'created_at',
  currentSortOrder: 'desc',
  uploadedImages: [],
  maxImages: 4,
  hashtagHistory: [],
  MAX_HASHTAG_HISTORY: 10,
  selectedPostIdsForBulkAction: new Set(),
  accountsData: window.accountsData || {},
  lastManualRefreshTime: 0,
  REFRESH_COOLDOWN_SECONDS: 5,
  duplicate_date_auto_adjust: true
};