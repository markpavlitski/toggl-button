/*jslint indent: 2, unparam: true*/
/*global window: false, XMLHttpRequest: false, chrome: false, btoa: false, localStorage:false */
"use strict";

var TogglButton = {
  $user: null,
  $curEntry: null,
  $apiUrl: "https://old.toggl.com/api/v7",
  $newApiUrl: "https://www.toggl.com/api/v8",
  $sites: new RegExp(
    [
      'asana\\.com',
      'podio\\.com',
      'trello\\.com',
      'github\\.com',
      'bitbucket\\.org',
      'gitlab\\.com',
      'redbooth\\.com',
      'teamweek\\.com',
      'basecamp\\.com',
      'unfuddle\\.com',
      'worksection\\.com',
      'pivotaltracker\\.com',
      'producteev\\.com',
      'sifterapp\\.com',
      'docs\\.google\\.com',
      'drive\\.google\\.com',
      'redmine\\.org',
      'myjetbrains\\.com',
      'zendesk\\.com',
      'capsulecrm\\.com',
      'web\\.any\\.do',
      'todoist\\.com'
    ].join('|')
  ),

  checkUrl: function (tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete') {
      /*if (TogglButton.$sites.test(tab.url)) {
        TogglButton.setBrowserAction();
      } else */if (/toggl\.com\/track/.test(tab.url)) {
        TogglButton.fetchUser(TogglButton.$apiUrl);
      } else if (/toggl\.com\/app\/index/.test(tab.url)) {
        TogglButton.fetchUser(TogglButton.$newApiUrl);
      }
    }
  },

  fetchUser: function (apiUrl, token) {
    TogglButton.ajax('/me?with_related_data=true', {
      token: token || ' ',
      baseUrl: apiUrl,
      onLoad: function (xhr) {
        var resp, apiToken, projectMap = {};
        if (xhr.status === 200) {
          resp = JSON.parse(xhr.responseText);
          if (resp.data.projects) {
            resp.data.projects.forEach(function (project) {
              projectMap[project.name] = project;
            });
          }
          TogglButton.$user = resp.data;
          TogglButton.$user.projectMap = projectMap;
          localStorage.removeItem('userToken');
          localStorage.setItem('userToken', resp.data.api_token);
        } else if (apiUrl === TogglButton.$apiUrl) {
          TogglButton.fetchUser(TogglButton.$newApiUrl);
        } else if (apiUrl === TogglButton.$newApiUrl && !token) {
          apiToken = localStorage.getItem('userToken');
          if (apiToken) {
            TogglButton.fetchUser(TogglButton.$newApiUrl, apiToken);
          }
        }
      }
    });
  },

  createTimeEntry: function (timeEntry) {
    var project, start = new Date(),
      entry = {
        time_entry: {
          start: start.toISOString(),
          description: timeEntry.description,
          wid: TogglButton.$user.default_wid,
          pid: timeEntry.projectId || null,
          billable: timeEntry.billable || false,
          duration: -(start.getTime() / 1000),
          created_with: timeEntry.createdWith || 'TogglButton'
        }
      };

    if (timeEntry.projectName !== undefined) {
      project = TogglButton.$user.projectMap[timeEntry.projectName];
      entry.time_entry.pid = project && project.id;
      entry.time_entry.billable = project && project.billable;
    }

    TogglButton.ajax('/time_entries', {
      method: 'POST',
      payload: entry,
      onLoad: function (xhr) {
        var responseData;
        responseData = JSON.parse(xhr.responseText);
        entry = responseData && responseData.data;
        TogglButton.$curEntry = entry;
        TogglButton.setBrowserAction(entry);
      }
    });
  },

  ajax: function (url, opts) {
    var xhr = new XMLHttpRequest(),
      method = opts.method || 'GET',
      baseUrl = opts.baseUrl || TogglButton.$newApiUrl,
      token = opts.token || (TogglButton.$user && TogglButton.$user.api_token);

    xhr.open(method, baseUrl + url, true);
    if (opts.onLoad) {
      xhr.addEventListener('load', function () { opts.onLoad(xhr); });
    }
    if (token && token !== ' ') {
      xhr.setRequestHeader('Authorization', 'Basic ' + btoa(token + ':api_token'));
    }
    xhr.send(JSON.stringify(opts.payload));
  },

  stopTimeEntry: function () {
    if (!TogglButton.$curEntry) { return; }
    var stopTime = new Date(),
      startTime = new Date(-TogglButton.$curEntry.duration * 1000);

    TogglButton.ajax("/time_entries/" + TogglButton.$curEntry.id, {
      method: 'PUT',
      payload: {
        time_entry: {
          stop: stopTime.toISOString(),
          duration: Math.floor(((stopTime - startTime) / 1000))
        }
      },
      onLoad: function (xhr) {
        if (xhr.status === 200) {
          TogglButton.$curEntry = null;
          TogglButton.setBrowserAction(null);
        }
      }
    });
  },

  updateTimeEntry: function (timeEntry) {
    if (!TogglButton.$curEntry) { return; }
    TogglButton.ajax("/time_entries/" + TogglButton.$curEntry.id, {
      method: 'PUT',
      payload: {
        time_entry: {
          description: timeEntry.description,
          pid: timeEntry.pid
        }
      }
    });
  },

  setBrowserActionBadge: function () {
    var badge = "";
    if (TogglButton.$user === null) {
      badge = "x";
      TogglButton.setBrowserAction(null);
    }
    chrome.browserAction.setBadgeText(
      {text: badge}
    );
  },

  setBrowserAction: function (runningEntry) {
    var imagePath = {'19': 'images/inactive-19.png', '38': 'images/inactive-38.png'};
    var title = chrome.runtime.getManifest().browser_action.default_title;
    if (runningEntry !== null) {
      imagePath = {'19': 'images/active-19.png', '38': 'images/active-38.png'};
      title = runningEntry.description + " - Toggl";
    }
    chrome.browserAction.setTitle({
      title: title
      });
    chrome.browserAction.setIcon({
      path: imagePath
    });
  },

  newMessage: function (request, sender, sendResponse) {
    if (request.type === 'activate') {
      TogglButton.setBrowserActionBadge();
      sendResponse({success: TogglButton.$user !== null, user: TogglButton.$user});
    } else if (request.type === 'timeEntry') {
      TogglButton.createTimeEntry(request);
    } else if (request.type === 'update') {
      TogglButton.updateTimeEntry(request);
    } else if (request.type === 'stop') {
      TogglButton.stopTimeEntry();
    } else if (request.type === 'userToken') {
      if (!TogglButton.$user) {
        TogglButton.fetchUser(TogglButton.$newApiUrl, request.apiToken);
      }
    }
  }

};

chrome.browserAction.onClicked.addListener(function (tab) {
  if (TogglButton.$user === null) {
    chrome.tabs.create({url: 'https://www.toggl.com/#login'});
  }
});

TogglButton.fetchUser(TogglButton.$apiUrl);
chrome.tabs.onUpdated.addListener(TogglButton.checkUrl);
chrome.extension.onMessage.addListener(TogglButton.newMessage);
