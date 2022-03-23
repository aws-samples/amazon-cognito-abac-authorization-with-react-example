import React from 'react'
import Navbar from 'react-bootstrap/Navbar'
import Container from 'react-bootstrap/Container'
import Nav from 'react-bootstrap/Nav'

class NavBar extends React.Component {
    render() {
        return (
            <Navbar bg="dark" variant="dark" expand="lg" style={{marginBottom: '50px'}}>
            <Container>
                <Navbar.Brand href="/home">Sample React App</Navbar.Brand>
                <Navbar.Toggle aria-controls="basic-navbar-nav" />
                <Navbar.Collapse id="basic-navbar-nav">
                <Nav className="me-auto">
                    <Nav.Link href="/signup">Signup</Nav.Link>
                    <Nav.Link href="/signin">Log in</Nav.Link>
                    <Nav.Link href="/apiaccess">API Access</Nav.Link>
                    <Nav.Link href="/s3access">S3 Access</Nav.Link>
                </Nav>
                </Navbar.Collapse>
            </Container>
            </Navbar>
        )
    }
}

export default NavBar