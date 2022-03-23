import React from 'react';
import JSONPretty from 'react-json-pretty';

import * as AmazonCognitoIdentity from 'amazon-cognito-identity-js'

import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'
import Container from 'react-bootstrap/esm/Container';

class SignIn extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            username: "",
            password: "",
            idToken: "",
            accessToken: "",
        }
    }

    validateForm = () => {
        return this.state.username.length > 0 && this.state.password.length > 0;
    }

    parseJwt = (token) => {
        var base64Url = token.split('.')[1];
        var base64 = base64Url.replace('-', '+').replace('_', '/');
        return JSON.parse(window.atob(base64));
    }

    login = (event) => {
        event.preventDefault();
        const { username, password } = this.state

        var authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
            Username: username,
            Password: password
        });

        console.log("--------Authenticate --- "+username)

        const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: username,
            Pool: this.props.userPool,
        })
        
        cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: function(result) {
                var idToken = result.getIdToken().getJwtToken();
                var accessToken = result.getAccessToken().getJwtToken();
                this.setState({
                    idToken: JSON.stringify(this.parseJwt(idToken)),
                    accessToken: JSON.stringify(this.parseJwt(accessToken))
                })
                this.props.setUser(cognitoUser)
            }.bind(this),

            onFailure: function(err) {
                alert(err.message || JSON.stringify(err));
            }
        });
    }

    render() {
        const showButton = this.validateForm()
        return (
            <div>
                <Container style={{ width: '50%'}}>
                    <Form onSubmit={this.login}>
                        <Form.Group size="lg" controlId="email">
                            <Form.Label>Username</Form.Label>
                            <Form.Control
                                autoFocus
                                type="text"
                                value={this.state.username}
                                onChange={(e) => this.setState({username: e.target.value})}
                            />
                        </Form.Group>
                        <Form.Group size="lg" controlId="password">
                            <Form.Label>Password</Form.Label>
                            <Form.Control
                                type="password"
                                value={this.state.password}
                                onChange={(e) => this.setState({password: e.target.value})}
                            />
                        </Form.Group>
                        
                        <Button size="lg" type="submit" disabled={!showButton} style={{marginTop: '10px'}}>
                            Login
                        </Button>
                    </Form>
                </Container>
                { this.state.idToken && this.state.accessToken && 
                    <Container>
                        <h3>ID Token</h3>
                        <JSONPretty id="idtoken-json-pretty" data={this.state.idToken} />
                        <h3>Access Token</h3>
                        <JSONPretty id="idtoken-json-pretty" data={this.state.accessToken} />
                    </Container>
                }
            </div>
        )
    }
}

export default SignIn