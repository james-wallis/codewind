# Codewind: Prototype application communication

## Design bits
```
{
    "projectID": "bbe6aac0-4381-11ea-84b8-5f9f6507a606",
    "name": "noddy",
    "connectedProjects": [
        {
            "projectID": "911c90d0-339a-11ea-bbad-9dca553ae31e",
            "projectName": "javaApp",
            "env": "process.env.PROJECT_ID",
            "url": "appbaseURL or host+port (aka what we use to talk to performance)",
            "connectionID": "K60NGBW9",
            "connectionURL": "https://codewind-gatekeeper-k56r8d8f.apps.exact-mongrel-icp-mst.9.20.195.90.nip.io",
        },
        {
            ...
        }
    ]
}
```

## CWCTL parts
`cwctl project connect` ? 

## Demo
1. Start Codewind local
2. Start Codewind remote
3. Use `cwctl connections add` to make `cwctl` aware of the remote
    * `cwctl` can now contact both local and remote instances
4. Create a Node.js application through local (`cwctl project create` + `cwctl project bind`)
5. Create a Node.js application through remote (`cwctl project create` + `cwctl project bind`)
6. Tell the local Node.js application that the remote Node.js application exists.
    * `cwctl project network add`
7. Local Node.js application will restart and have a new environment variable with the value of the remote Node.js application's url
8. Do a `cwctl project network get {local Node.js application's ID}` to get the name of the new environment variable
9. Edit the local Node.js application to use the environment variable to talk to the remote Node.js application
10. [Optional] do a `cwctl project network edit {local Node.js application's ID}` to change the name of the environment variable
    * Use this to demonstrate that the name of the environment variable can be the production one = less changes in production

### Steps needed to reach the demo
- [ ] Add an API that can add a new connectedProject to an existing project
- [ ] Tell fw that it needs to add the environment variable to the Docker container
- [ ] Add an API that can get the connectProject list
- [ ] Add a `cwctl project network add` which can call the new API and connect two applications
- [ ] Add a `cwctl project network get` which can get the connectedProjects for a project (this will get the environment variable name to use in the new application)

#### Optional extras
- [ ] Add an API which can edit a connectedProject for a project so we can update the environment variable name
- [ ] Add a `cwctl project network edit` which can edit the connections (and the environment variable for the demo application)

## License
[EPL 2.0](https://www.eclipse.org/legal/epl-2.0/)
