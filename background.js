// Global variables
let autoSaveTimer = null;

// Helper functions
function getIntervalInMs(interval, unit) {
 const minute = 60 * 1000;
 const hour = 60 * minute;
 const day = 24 * hour;

 switch (unit) {
   case 'minutes': return interval * minute;
   case 'hours': return interval * hour;
   case 'days': return interval * day;
   default: return interval * minute;
 }
}

function setupAutoSave(enabled, interval, unit) {
 if (autoSaveTimer) {
   clearInterval(autoSaveTimer);
   autoSaveTimer = null;
 }

 if (enabled && interval > 0) {
   const intervalMs = getIntervalInMs(interval, unit);
   autoSaveTimer = setInterval(saveAllTabs, intervalMs);
 }
}

async function saveAllTabs() {
    const settings = await chrome.storage.sync.get({
      maxAutosaveCount: 10
    });
  
    const savedData = await new Promise((resolve) => {
      chrome.storage.local.get(['windowNames'], function(result) {
        const windowNames = result.windowNames || {};
        
        chrome.windows.getAll({ populate: true }, function(windows) {
          let savedTabs = [];
          let processedWindows = 0;
          
          windows.forEach(function(window) {
            let windowData = {
              windowId: window.id,
              tabs: [],
              groups: {}
            };
  
            chrome.tabGroups.query({ windowId: window.id }, function(groups) {
              groups.forEach(group => {
                windowData.groups[group.id] = {
                  title: group.title,
                  color: group.color,
                  tabs: []
                };
              });
  
              window.tabs.forEach(function(tab) {
                const tabData = {
                  url: tab.url,
                  title: tab.title,
                  favIconUrl: tab.favIconUrl || `chrome://favicon/${tab.url}`,
                  discarded: tab.discarded || false
                };
  
                if (tab.groupId > -1) {
                  if (windowData.groups[tab.groupId]) {
                    windowData.groups[tab.groupId].tabs.push(tabData);
                  }
                } else {
                  windowData.tabs.push(tabData);
                }
              });
  
              savedTabs.push(windowData);
              processedWindows++;
  
              if (processedWindows === windows.length) {
                resolve({ savedTabs, windowNames });
              }
            });
          });
        });
      });
    });
  
    if (settings.maxAutosaveCount > 0) {
      const autosaves = (await chrome.storage.local.get(['autoSavedSessions'])).autoSavedSessions || [];
      
      const newAutosave = {
        timestamp: new Date().toISOString(),
        savedTabs: savedData.savedTabs || [],
        windowNames: savedData.windowNames || {}
      };
      
      autosaves.unshift(newAutosave);
      while (autosaves.length > settings.maxAutosaveCount) {
        autosaves.pop();
      }
      
      await chrome.storage.local.set({ 
        autoSavedSessions: autosaves,
        savedTabs: savedData.savedTabs,
        windowNames: savedData.windowNames
      });
    } else {
      await chrome.storage.local.set({ 
        savedTabs: savedData.savedTabs,
        windowNames: savedData.windowNames
      });
    }
  }

// Event Listeners
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveTabs") {
    saveAllTabs().then(() => {
      sendResponse({ status: "success" });
    }).catch(error => {
      sendResponse({ status: "error", message: error.message });
    });
    return true;
  } else if (message.action === 'updateAutoSave') {
    setupAutoSave(
      message.settings.autoSave,
      message.settings.autoSaveInterval,
      message.settings.autoSaveUnit
    );
  }
});

// Listen for tab state changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
 console.log('Tab updated:', {tabId, changeInfo, tab});
 
 if (changeInfo.hasOwnProperty('discarded')) {
   console.log('Discarded state changed:', {
     tabId,
     url: tab.url,
     discarded: changeInfo.discarded
   });
   
   chrome.runtime.sendMessage({
     action: "tabStateChanged",
     tabId: tabId,
     url: tab.url,
     discarded: changeInfo.discarded
   }, () => {
     if (chrome.runtime.lastError) {
       // Handle error silently - popup might not be open
     }
   });
 }
});

// Initialize autosave on startup
chrome.storage.sync.get({
 autoSave: false,
 autoSaveInterval: 15,
 autoSaveUnit: 'minutes'
}, function(items) {
 if (items.autoSave) {
   setupAutoSave(true, items.autoSaveInterval, items.autoSaveUnit);
 }
});




