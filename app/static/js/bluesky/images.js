// Save original rerenderImages function
window.originalRerenderImages = function() {
  window.debugLog('DEBUG: Rerendering images, count:', AppConfig.uploadedImages.length);
  const $grid = $('#image-grid').empty();
  AppConfig.uploadedImages.forEach((img, index) => {
    window.debugLog('DEBUG: Rendering image', index, '- id:', img.id, 'name:', img.name, 'isUploading:', img.isUploading);
    const hasAlt = img.alt && img.alt.trim() !== '';
    
    // Check if image was optimized (has originalSize property)
    const isOptimized = img.originalSize && img.originalSize > img.size;
    const sizeInfo = isOptimized
    ? `${formatFileSize(img.originalSize)} → ${formatFileSize(img.size)}`
    : formatFileSize(img.size);

    // Check if image is large (>1MB) for UI styling
    const isLargeImage = img.size > 1048576 || (img.originalSize && img.originalSize > 1048576);

    const $item = $(`<div class="image-item ${isLargeImage ? 'large-image' : ''}" data-image-id="${img.id}" draggable="true">
      <img src="${img.url}" alt="${img.alt || img.name}" class="image-preview">
      ${img.isUploading ? '<div class="thumbnail-spinner"></div><div class="optimizing-overlay"></div>' : ''}
      <div class="image-overlay">
        <button type="button" class="image-btn move-left"><i class="fas fa-chevron-left"></i></button>
        <button type="button" class="image-btn delete"><i class="fas fa-trash"></i></button>
        <button type="button" class="image-btn move-right"><i class="fas fa-chevron-right"></i></button>
      </div>
      <button type="button" class="image-btn alt-text-btn" title="ALT テキスト編集">
        <i class="fas ${hasAlt ? 'fa-check-circle text-success' : 'fa-edit'}"></i>
      </button>
      <div class="image-order-indicator">${index + 1}</div>
      <div class="image-info">
        <div class="image-name" title="${img.name}">${img.name}</div>
        <div class="image-size ${isOptimized ? 'optimized' : ''}">${sizeInfo}</div>
      </div>
    </div>`);

    $item.find('.image-preview, .image-info').click((e) => {
      openFullscreenPreview(img.url, img.alt || img.name);
    });
    $item.find('.alt-text-btn').click((e) => {
      e.stopPropagation();
      openAltTextModal(img.id, img.alt || '');
    });
    $grid.append($item);
  });
  updateOrderIndicators();
  updateImageOrderInputs();
}

function updateFileInputFromArray() {
  // Clear the file input
  // Note: files property is read-only and cannot be set directly
  // We'll simply clear the file input as the files are managed by AppConfig.uploadedImages
  $('#file-input').val('');
}

function updateImageControls() {
  // Remove all existing event handlers to avoid duplicates
  $('.image-btn.move-left').off('click');
  $('.image-btn.move-right').off('click');
  $('.image-btn.delete').off('click');
  
  // Reattach event handlers
  $('.image-btn.move-left').on('click', function() {
    window.handleImageAction('left', $(this).closest('.image-item').data('imageId'));
  });
  
  $('.image-btn.move-right').on('click', function() {
    window.handleImageAction('right', $(this).closest('.image-item').data('imageId'));
  });
  
  $('.image-btn.delete').on('click', function() {
    window.handleImageAction('delete', $(this).closest('.image-item').data('imageId'));
  });
}

function updateImageOrderInputs() {
  // Update hidden inputs with current image order
  const orderInputs = $('#image-order-inputs');
  orderInputs.empty();
  
  $('#image-grid .image-item').each(function(index) {
    const imageId = $(this).data('imageId');
    orderInputs.append(`<input type="hidden" name="image_order[]" value="${imageId}">`);
  });
}

function updateOrderIndicators() {
  // Update the order indicators in the UI
  $('#image-grid .image-order-indicator').each(function(index) {
    $(this).text(index + 1);
  });
}

window.handleImageAction = function(action, imageId) {
  window.debugLog('DEBUG: Image action:', action, 'for image ID:', imageId);
  const imgIndex = AppConfig.uploadedImages.findIndex(img => img.id === imageId);
  if (imgIndex === -1) {
    window.debugLog('DEBUG: Image not found');
    return;
  }
  
  window.debugLog('DEBUG: Image found at index:', imgIndex);
  
  if (action === 'delete') {
    window.debugLog('DEBUG: Deleting image:', AppConfig.uploadedImages[imgIndex].name);
    AppConfig.uploadedImages.splice(imgIndex, 1);
    rerenderImages();
    updateImageControls();
    updateFileInputFromArray();
  } else if (action === 'left' && imgIndex > 0) {
    window.debugLog('DEBUG: Moving image left from index', imgIndex, 'to', imgIndex - 1);
    // Swap with previous item
    [AppConfig.uploadedImages[imgIndex], AppConfig.uploadedImages[imgIndex - 1]] = 
    [AppConfig.uploadedImages[imgIndex - 1], AppConfig.uploadedImages[imgIndex]];
    rerenderImages();
    updateImageControls();
    updateFileInputFromArray();
  } else if (action === 'right' && imgIndex < AppConfig.uploadedImages.length - 1) {
    window.debugLog('DEBUG: Moving image right from index', imgIndex, 'to', imgIndex + 1);
    // Swap with next item
    [AppConfig.uploadedImages[imgIndex], AppConfig.uploadedImages[imgIndex + 1]] = 
    [AppConfig.uploadedImages[imgIndex + 1], AppConfig.uploadedImages[imgIndex]];
    rerenderImages();
    updateImageControls();
    updateFileInputFromArray();
  } else {
    window.debugLog('DEBUG: Invalid action or index out of bounds');
  }
}

function openFullscreenPreview(url, altText) {
  // Remove any existing lightbox and event handlers
  $('#fullscreen-lightbox').remove();
  $(document).off('keydown.fullscreen-preview');

  // Create lightbox
  const $lightbox = $(`<div id="fullscreen-lightbox">
    <button type="button" class="lightbox-close" aria-label="閉じる"><i class="fas fa-times"></i></button>
    <img class="lightbox-image" src="" alt="">
    <div class="lightbox-caption"></div>
  </div>`);
  $('body').append($lightbox);

  // Close handlers
  function closeLightbox() {
    $lightbox.removeClass('lightbox-show');
    setTimeout(() => {
      $lightbox.remove();
      $(document).off('keydown.fullscreen-preview');
    }, 300);
  }

  $lightbox.on('click', '.lightbox-close', closeLightbox);
  $lightbox.on('click', function(e) {
    if (e.target === this) closeLightbox();
  });
  $(document).on('keydown.fullscreen-preview', function(e) {
    if (e.key === 'Escape') closeLightbox();
  });

  // Update image source and caption
  $lightbox.find('.lightbox-image').attr('src', url);
  $lightbox.find('.lightbox-caption').text(altText || '');

  // Show lightbox
  requestAnimationFrame(() => $lightbox.addClass('lightbox-show'));
}

function openAltTextModal(imageId, currentAlt) {
  const $modal = $('#alt-text-modal');
  $modal.find('#alt-text-input').val(currentAlt);
  $modal.find('#alt-text-image-id').val(imageId);
  $modal.addClass('active');
}

function saveAltText() {
  const imageId = $('#alt-text-image-id').val();
  const newAlt = $('#alt-text-input').val();
  
  const imgIndex = AppConfig.uploadedImages.findIndex(img => img.id === imageId);
  if (imgIndex === -1) return;
  
  AppConfig.uploadedImages[imgIndex].alt = newAlt;
  rerenderImages();
  updateImageControls();
  updateFileInputFromArray();
  $('#alt-text-modal').removeClass('active');
}

function clearAltText() {
  const imageId = $('#alt-text-image-id').val();
  const imgIndex = AppConfig.uploadedImages.findIndex(img => img.id === imageId);
  if (imgIndex === -1) return;
  
  AppConfig.uploadedImages[imgIndex].alt = '';
  rerenderImages();
  updateImageControls();
  updateFileInputFromArray();
  $('#alt-text-modal').removeClass('active');
}

// Alias for backward compatibility
window.rerenderImages = function() {
    window.originalRerenderImages();
    if (typeof updateSubmitButtonState === 'function') {
        updateSubmitButtonState();
    }
};
