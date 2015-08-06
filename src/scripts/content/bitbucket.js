/*jslint indent: 2, unparam: true*/
/*global $: false, document: false, togglbutton: false*/
'use strict';

togglbutton.render('#issue-header', {}, function (elem) {
  var link, description,
    numElem = $('.issue-id'),
    titleElem = $('#issue-title'),
    projectElem = $('.repo-link');

  description = titleElem.innerText;
  if (numElem !== null) {
    description = numElem.innerText + " " + description;
  }

  link = togglbutton.createTimerLink({
    className: 'bitbucket',
    description: description,
    projectName: projectElem && projectElem.textContent
  });

  $('#issue-header').appendChild(link);
});

togglbutton.render('#pullrequest', {}, function (elem) {
  var link, description,
    numElem = $('.pull-request-status > a', elem),
    titleElem = $('.pull-request-title > h1', elem),
    projectElem = $('.aui-page-header-main > h1 > a.entity-name');

  description = titleElem.innerText;
  if (numElem !== null) {
    description = "PR-" + numElem.textContent.substr(1) + " " + description;
  }

  link = togglbutton.createTimerLink({
    className: 'bitbucket-pr',
    description: description,
    projectName: projectElem && projectElem.textContent
  });

  $('.compare-widget-container', elem).appendChild(link);
});
