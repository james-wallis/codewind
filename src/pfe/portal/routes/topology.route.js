/*******************************************************************************
 * Copyright (c) 2020 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
const express = require('express');
const router = express.Router();

const Logger = require('../modules/utils/Logger');

const log = new Logger(__filename);

router.get('/api/v1/topology', (req, res) => {
  const { cw_user: { projectList } } = req;
  const projects = projectList.retrieveProjects();

  const topology = projects.reduce((obj, { projectID, links }) => {
    return {
      ...obj,
      [projectID]: {
        to: links.getAll(),
        from: getFromLinks(projectID, projects),
      },
    };
  }, {});

  res.status(200).send(topology);
});

const getFromLinks = (projectID, projects) => {
  const fromLinks = projects.map(({ projectID: toProjectID, name: toProjectName, links }) => {
    const toLinksForThisProject = links.getAll().filter(link => link.projectID === projectID);
    return toLinksForThisProject.map(({ envName }) => ({
      projectID: toProjectID,
      projectName: toProjectName,
      envName,
    }));
  });
  return fromLinks.filter(arr => arr.length > 0);
}

module.exports = router;
