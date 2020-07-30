# TrackWeave - Ramifiable and Directed Transactions

TrackWeave is an implementation for the Ramifiable and Directed Transactions (RDT) data structure,
a new and intuitive way to link Arweave transactions through chronology, branches and forks (branches).

RDT is a data structure that aggregates the chronology of a linked list,
the ramifiability of [tree structures](https://en.wikipedia.org/wiki/Tree_(data_structure)) and the versatility of
graphs structures. This allows one to traverse along a chain of transactions chronologically, while retaining the 
successive and acyclic ideals of a blockchain. The RDT data structure also supports forks, which opens a myriad of opportunities
for your data and metadata through the relationships this kinda of structure can express.
RDT has subtrees which allow you to link an independent tree to a node that exists elsewhere.
This allows independent ecosystems to easily traverse **into** separate ecosystems.

## TrackWeave API

__Todo.__

## RDT Specification (WIP)

> Terminology relating to tree structures is used in conjunction with graph terminology

RDT uses nanoids for random IDS, denoted by R.

A random string of the same tag in the previous transaction is denoted by <-R

A number is denoted by N.

Tags in the format `Tag?: Data` represent optional tags.

To create a RDT graph, a root node must be configured with the following tags:

```
# An easy way to indicate that this is the root. Useful for ArQL
RDT-Type: "Root"
RDT-Version?: [Currently, 0.0.1]

Root-Id: R
Edge-Head: R
# You can initialise your own sub-tree through this value.
Edge-Tail?: <-R
```

Regular Transactions that you wish to participate in a graph
are configured with the following tags

```
RDT-Type: "Node"
RDT-Version?: [Currently, 0.0.1]

Root-Id: <-R
Edge-Head: [R OR See Rejoining a Fork]
Edge-Tail: <-R

# Use zero if the degree of the tree is 0.
Fork-Depth: <-N OR 0 OR <-N + 1
# Used to keep track of how many forks exist and whether they have rejoined.
Pending-Fork-Rejoins: <-N OR 0 OR <-N + 1 OR N - 1
# When a fork is made, this value must reflect the root of the fork.
Fork-Tail?: [Value of Edge-Tail]
Fork-Head?: [Value of Edge-Head]

# A waypoint is a means to quickly jump up the chain
# if you're stuck at the bottom of it.
# To create a new waypoint, set the value of Waypoint-Tail
# to your current Edge-Tail and the value of Waypoint-Head
# to your current Edge-Head. To maintain the current waypoint,
# use the previous value of Waypoint-Tail and Waypoint-Head
Waypoint-Tail: [Previous Waypoint-Tail OR Value of Edge-Tail]
Waypoint-Head: [Previous Waypoint-Head OR Value of Edge-Head]
```

## Forks/Branches

Forking a tree is rather trivial, you just continue the tree but you add 1 to the fork depth.
Adding or subtracting more than 1 to the fork depth will make it invalid and the fork will be ignored.
When a fork is created, its waypoint will be reset to reflect the root of the fork.

### New forks

Every time a node is added to a chain, it checks if a fork has been made, this is done by querying for the following:

```
RDT-Type: "Node"
Root-Id: [Current Root-Id]
Fork-Depth: [Fork-Depth + 1]
Edge-Tail: [Current Waypoint-Head]
```

If a fork is found, the following transaction should have 1 added to the value of `Pending-Fork-Rejoins`.

#### Rejoining a fork

To rejoin with the chain of the ancestral origin of a fork, the latest tx of that chain needs to be used as
the `Edge-Head`. If you attempt to rejoin to a node that predates the `Waypoint-Tail`, the rejoin will be ignored.

Every time a node is added to the chain, it should check if a fork has been merged, the following tags will aid this:

```
RDT-Type: "Node"
Root-Id: [Current Root-Id]
Fork-Depth: [Fork-Depth + 1]
Edge-Head: [Current Waypoint-Head]
```

If it has been rejoined, the value of `Pending-Fork-Rejoins` should have 1 subtracted from it.

### Creating subtrees

A subtree is similar to a fork, but is useful for different things.
A fork allows an insertion of alternative history before potentially
migrating to the latest head of the chain of its ancestral origin (rejoining).

A subtree is the same as starting a new tree, however in reference to a previous node.
This is useful if you wish to demonstrate that there is a relationship with a
node and the genesis of a new tree.

Creating a subtree is exactly the same as creating a root node, however the `Edge-Tail` tag

## Inspirations

 - [Linked Lists](https://en.wikipedia.org/wiki/Linked_list)
 - [DAG](https://en.wikipedia.org/wiki/Directed_acyclic_graph)

## License

License under the MIT License. See more in [LICENSE](./LICENSE)