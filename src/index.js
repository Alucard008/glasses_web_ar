import React from 'react';
import { render } from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import { Switch, Route, BrowserRouter as Router } from 'react-router-dom';

import './styles/index.scss';

import DemoVTOGlasses from './js/demos/VTOGlasses.js';

render(
  <AppContainer>
    <Router>
      <Switch>
        <Route path="/">
          <DemoVTOGlasses />
        </Route>
      </Switch>
    </Router>
  </AppContainer>,
  document.querySelector('#root')
);
