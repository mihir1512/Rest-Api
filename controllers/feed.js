const fs=require('fs')
const path=require('path')
const { validationResult } = require('express-validator')

const io=require('../socket')
const Post = require('../models/post')
const User=require('../models/user')

exports.getPosts = async (req, res, next) => {
  try {
    const currentPage=req.query.page
    const perPage=2
    const count=await Post.countDocuments()
    const posts=await Post.find().populate('creator').sort({createdAt:-1}).skip(currentPage-1).limit(perPage)

    
    res.status(200).json({ message: 'Fetched posts successfully.', posts: posts ,totalItems:count})

  } catch (error) {
    if (!err.statusCode) {
      err.statusCode = 500
    }
    next(error)
  }
};

exports.createPost = async (req, res, next) => {

  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed, entered data is incorrect.")
      error.statusCode = 422
      throw error
    }

    if (!req.file) {
      const error = new Error('No image provided.')
      error.statusCode = 422
      throw error
    }
    const title = req.body.title;
    const content = req.body.content;
    const imageUrl = req.file.path.replace("\\", "/");
    const post = new Post({
      title: title,
      content: content,
      imageUrl: imageUrl,
      creator: req.userId
    })
     await post.save()
    // console.log(result);
    const user=await User.findById(req.userId)
    user.posts.push(post)
    const result=await user.save()
    io.getIO().emit('posts',{action:'create',post:{...post._doc,creator:{_id:req.userId,name:user.name}}})
    res.status(201).json({
      message: 'Post created successfully!',
      post: post,
      creator:{_id:user._id,name:user.name}
    });

  } catch (error) {
    if (!error.statusCode) {

      error.statusCode = 500
    }
    next(error)
  }

};

exports.getPost = async (req, res, next) => {
  try {
    const postId = req.params.postId
    const post = await Post.findById(postId)
    if (!post) {
      const error = new Error('Could not find post.')
      error.statusCode = 404
      throw error
    }
    res.status(200).json({ message: 'Post Created.', post: post })
  } catch (error) {
    if (!error.statusCode) {

      error.statusCode = 500
    }
    next(error)
  }
}

exports.updatePost = async(req, res, next) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      const error = new Error("Validation failed, entered data is incorrect.")
      error.statusCode = 422
      throw error
    }

    const postId = req.params.postId
    const title = req.body.title
    const content = req.body.content
    let imageUrl = req.body.image
    if (req.file) {
      imageUrl = req.file.path
    }
    if (!imageUrl) {
      const error = new Error('No file picked.')
      error.statusCode = 422
      throw error
    }
    const post=await Post.findById(postId).populate('creator')
    if(!post){
      const error=new Error('Could not find post.')
      error.statusCode=404
      throw error
    }
    if(post.creator._id.toString() !== req.userId)
    {
      const error=new Error('Could not find post.')
      error.statusCode=404
      throw error
    }
    
    if(imageUrl!==post.imageUrl)
    {
      clearImage(post.imageUrl)
    }
    post.title=title
    post.imageUrl=imageUrl
    post.content=content
    const result=await post.save()
    io.getIO().emit('posts',{action:'update',post:result})

    res.status(200).json({message:'Post updated!',post:result})
  }
  catch (error) {
    if (!error.statusCode) {

      error.statusCode = 500
    }
    next(error)
  }
}

exports.deletePost=async(req,res,next)=>{
  try {
    
    const postId=req.params.postId

    const post=await Post.findById(postId)
    if(!post){
      const error=new Error('Could not find post.')
      error.statusCode=404
      throw error
    }
    if(post.creator.toString() !== req.userId)
    {
      const error=new Error('Could not find post.')
      error.statusCode=404
      throw error
    }
  
    clearImage(post.imageUrl)
               await Post.findByIdAndRemove(postId)
    const user=await User.findById(req.userId)  
    const result=await user.posts.pull(postId)
               await user.save() 
    io.getIO().emit('posts',{action:'delete',post:postId})
    res.status(200).json({message:'Deleted post.'})
  } catch (error) {
    if (!error.statusCode) {

      error.statusCode = 500
    }
    next(error)
  }
 



}

const clearImage=filePath=>{
  filePath=path.join(__dirname,'..',filePath)
  fs.unlink(filePath,err=>console.log(err))
}
