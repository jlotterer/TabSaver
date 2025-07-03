document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Loaded');


  // Load saved settings
  chrome.storage.sync.get({
    autoSave: false,
    autoSaveInterval: 15,
    autoSaveUnit: 'minutes',
    maxAutosaveCount: 10,
    rememberState: true,
    autoArchive: false
  }, function(items) {
    document.getElementById('autoSave').checked = items.autoSave;
    document.getElementById('autoSaveInterval').value = items.autoSaveInterval;
    document.getElementById('autoSaveUnit').value = items.autoSaveUnit;
    document.getElementById('maxAutosaveCount').value = items.maxAutosaveCount;
    document.getElementById('rememberState').checked = items.rememberState;
    document.getElementById('autoArchive').checked = items.autoArchive;

    // Enable/disable interval inputs based on autoSave state
    toggleIntervalControls(items.autoSave);

   });



  // Add event listener for the new setting
  document.getElementById('maxAutosaveCount').addEventListener('change', function(e) {
    const value = parseInt(e.target.value, 10);
    if (value >= 0) {
      saveSettings({ maxAutosaveCount: value });
    }
  });

  function saveSettings(settings) {
    chrome.storage.sync.set(settings, function() {
      const status = document.getElementById('status');
      status.textContent = 'Settings saved!';
      status.classList.add('show');
      setTimeout(function() {
        status.classList.remove('show');
      }, 2000);

      if ('autoSave' in settings || 'autoSaveInterval' in settings || 'autoSaveUnit' in settings) {
        chrome.runtime.sendMessage({
          action: 'updateAutoSave',
          settings: {
            autoSave: document.getElementById('autoSave').checked,
            autoSaveInterval: parseInt(document.getElementById('autoSaveInterval').value, 10),
            autoSaveUnit: document.getElementById('autoSaveUnit').value
          }
        });
      }
    });
  }

  function toggleIntervalControls(enabled) {
    document.getElementById('autoSaveInterval').disabled = !enabled;
    document.getElementById('autoSaveUnit').disabled = !enabled;
  }

  // Settings change event listeners
  document.getElementById('autoSave').addEventListener('change', function(e) {
    const enabled = e.target.checked;
    toggleIntervalControls(enabled);
    saveSettings({ autoSave: enabled });
  });

  document.getElementById('autoSaveInterval').addEventListener('change', function(e) {
    const value = parseInt(e.target.value, 10);
    if (value > 0) {
      saveSettings({ autoSaveInterval: value });
    }
  });

  document.getElementById('autoSaveUnit').addEventListener('change', function(e) {
    saveSettings({ autoSaveUnit: e.target.value });
  });

  document.getElementById('rememberState').addEventListener('change', function(e) {
    saveSettings({ rememberState: e.target.checked });
  });

  document.getElementById('autoArchive').addEventListener('change', function(e) {
    saveSettings({ autoArchive: e.target.checked });
  });
});

