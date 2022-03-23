import React from 'react';

import 'cross-fetch/polyfill';
import * as AmazonCognitoIdentity from 'amazon-cognito-identity-js'
import './App.css';

import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab'
import SignUp from './components/SignUp';
import SignIn from './components/SignIn';
import Home from './components/base-components/Home'
import ApiAccess from './components/ApiAccess';
import S3Access from './components/S3Access';

const config = require('./configuration.json')

class App extends React.Component {
  constructor(props) {
    super(props) 

    this.state = {
      cognitoUser: null
    }

    this.poolData = {
      UserPoolId: config.userPoolId,
      ClientId: config.clientId,
    };

    this.userPool = new AmazonCognitoIdentity.CognitoUserPool(this.poolData);
  }

  setCognitoUser = (user) => {
    this.setState({ cognitoUser: user })
  }

  render() {
    return (
      <div>
        <Tabs defaultActiveKey="home" id="uncontrolled-tab-example" className="mb-3">
          <Tab eventKey="home" title="Home">
            <Home />
          </Tab>
          <Tab eventKey="signup" title="Sign-up">
            <SignUp />
          </Tab>
          <Tab eventKey="signin" title="Sign-in">
            <SignIn userPool={this.userPool} setUser={this.setCognitoUser}/>
          </Tab>
          <Tab eventKey="apiaccess" title="API Access">
            <ApiAccess cognitoUser={this.state.cognitoUser} />
          </Tab>
          <Tab eventKey="s3access" title="S3 Access">
            <S3Access cognitoUser={this.state.cognitoUser} />
          </Tab>
        </Tabs>
      </div>
    )
  }
}

export default App;
