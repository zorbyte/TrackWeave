# TrackWeave - Ramifiable and Directed Transactions

TrackWeave is an implementation for the Ramifiable and Directed Transactions (RDT) data structure,
a new and intuitive way to link Arweave transactions through chronology, weak linked sub-trees and branches.

RDT is a data structure that aggregates the chronology of a [linked lists](https://en.wikipedia.org/wiki/Linked_list),
the ramifiability of [tree structure](https://en.wikipedia.org/wiki/Tree_(data_structure))s and the versatility of
[graphs structure](https://en.wikipedia.org/wiki/Graph_(data_structure))s. This allows one to traverse along a chain
of transactions chronologically, while retaining the successive and acyclic ideals of a blockchain.
The RDT data structure also supports branchs, which opens a myriad of opportunities
for your data and metadata through the relationships this kinda of structure can express.
RDT has subtrees which allow you to link an independent tree to a node that exists elsewhere.
This allows independent ecosystems to easily traverse **into** separate ecosystems.

## TrackWeave API

__Todo.__

## RDT Specification (WIP)

> Terminology relating to tree structures is used in conjunction with graph terminology in this specification.

RDT uses [nanoid](https://github.com/ai/nanoid)s for its random strings for its random numbers.

### Key

A __new__ random number is denoted by R.

A random string of the same tag in the previous transaction is denoted by <-R

A number is denoted by N.

Tags in the format `Tag?: Data` represent optional tags.

### The root node

To create a RDT graph, a root node must be configured with the following tags:

```
# An easy way to indicate that this is the root. Useful for ArQL
RDT-Type: "Root"
RDT-Version?: [Currently, 0.0.2]

Root-Id: R
Edge-Head: R
# You can initialise your own sub-tree through this value.
Edge-Tail?: <-R
```

### Regular Nodes

Regular Transactions that you wish to participate in a graph
are configured with the following tags

```
RDT-Type: "Node"
RDT-Version?: [Currently, 0.0.2]

Root-Id: <-R
Edge-Head: [R OR See Rejoining a branch]
Edge-Tail: <-R

# Use zero if the degree of the tree is 0.
Branch-Depth: <-N OR 0 OR <-N + 1
# When a branch is made, this value must be included and
# should reflect the node that instantiated the branch.
Branch-Tail?: [Value of Edge-Tail]
# TODO: Contemplate whether or not Branch-Head is required.
# Branch-Head?: [Value of Edge-Head]

# A waypoint is a means to quickly jump around the chain
# if you're stuck in an undesirable location.
# When the degree of the tree is 0, the first waypoint is
# instantiated with both Waypoint-Tail and Waypoint-Head
# being assigned to an R. The waypoint values do not change
# unless you want to create a new waypoint.To create a new
# waypoint, set the value of Waypoint-Tail to the previous
# Waypoint-Head, and set the value the Waypoint-Head to an R.
Waypoint-Tail: [<-R OR Previous Waypoint-Head OR R]
Waypoint-Head: [<-R OR R]
```

## /Branches

Branching a tree is rather trivial, you just continue the tree but you add 1 to the branch depth.
Adding or subtracting more than 1 to the branch depth will make it invalid and the branch will be ignored.
When a branch is created, its waypoint will be reset to reflect the root of the branch.

### Querying branch

Every time a node is added to a chain, it checks if a branch has been made, this is done by querying for the following:

```
RDT-Type: "Node"
Root-Id: [Current Root-Id]
Branch-Depth: [Branch-Depth + 1]
Edge-Tail: [Current Branch-Head]
```

#### Rejoining a branch

To rejoin with the chain of the ancestral origin of a branch, any transaction of that chain that outdates the `Branch-Tail` needs to be used as
the `Edge-Head`. If you attempt to rejoin to a node that predates the `Branch-Tail`, the rejoin will be ignored by the traversal algorithm.

Every time a node is added to the chain, it should check if a branch has been merged, the following tags will aid this:

```
RDT-Type: "Node"
Root-Id: [Current Root-Id]
Branch-Depth: [Branch-Depth + 1]
Edge-Head: [Current Waypoint-Head]
```

### Creating subtrees

A subtree is similar to a branch, but is useful for different things.
A branch allows an insertion of alternative history before potentially
migrating to the latest head of the chain of its ancestral origin (rejoining).

A subtree is the same as starting a new tree, however in reference to a previous node.
This is useful if you wish to demonstrate that there is a relationship with a
node and the genesis of a new tree.

Creating a subtree is exactly the same as creating a root node, however the `Edge-Tail` tag

### Structural Integrity Checks

TODO: Write about how branch depths, chronology, branch heads and tails can be used to ensure that there is no "cyclic entanglements".

## Inspirations

 - [Linked Lists](https://en.wikipedia.org/wiki/Linked_list)
 - [DAG](https://en.wikipedia.org/wiki/Directed_acyclic_graph)

## License

License under the MIT License. See more in [LICENSE](./LICENSE)